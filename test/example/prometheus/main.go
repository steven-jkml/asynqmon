package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

type config struct {
	port int
}

type prometheusResponse struct {
	Status string         `json:"status"`
	Data   prometheusData `json:"data"`
}

type prometheusData struct {
	ResultType string             `json:"resultType"`
	Result     []prometheusSeries `json:"result"`
}

type prometheusSeries struct {
	Metric metricLabels    `json:"metric"`
	Values [][]interface{} `json:"values"`
}

type metricLabels struct {
	Name     string `json:"__name__"`
	Instance string `json:"instance"`
	Job      string `json:"job"`
	Queue    string `json:"queue,omitempty"`
	State    string `json:"state,omitempty"`
}

type metricSpec struct {
	name  string
	state string
	value func(queueIndex int, sampleIndex int) float64
}

var queueFilterPattern = regexp.MustCompile(`queue=~"([^"]+)"`)

var sampleQueues = []string{
	"q_default",
	"q_housekeeping",
	"q_order_confirmation",
	"q_order_notification",
	"q_catalogue_sync",
	"q_campaign_sync",
	"q_shop_connect",
	"q_shop_finance",
	"q_jakmall_sku_changes",
	"q_bind_catalogue_sku_order",
	"q_order_return",
	"q_product_review_sync",
}

func main() {
	cfg := config{}
	flag.IntVar(&cfg.port, "port", 9090, "port number to serve the sample Prometheus API on")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/api/v1/query_range", handleQueryRange)

	addr := fmt.Sprintf(":%d", cfg.port)
	log.Printf("sample Prometheus server listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func handleIndex(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("sample Prometheus server for asynqmon metrics testing\n"))
}

func handleQueryRange(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	spec, ok := metricSpecForQuery(query)
	if !ok {
		http.Error(w, fmt.Sprintf("unsupported query: %s", query), http.StatusBadRequest)
		return
	}

	start, err := strconv.ParseInt(r.URL.Query().Get("start"), 10, 64)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid start: %v", err), http.StatusBadRequest)
		return
	}
	end, err := strconv.ParseInt(r.URL.Query().Get("end"), 10, 64)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid end: %v", err), http.StatusBadRequest)
		return
	}
	step, err := strconv.ParseInt(r.URL.Query().Get("step"), 10, 64)
	if err != nil || step <= 0 {
		http.Error(w, fmt.Sprintf("invalid step: %v", err), http.StatusBadRequest)
		return
	}

	queues := filterQueues(query)
	result := make([]prometheusSeries, 0, len(queues))
	for queueIndex, queueName := range queues {
		series := prometheusSeries{
			Metric: metricLabels{
				Name:     spec.name,
				Instance: "sample-prometheus",
				Job:      "test/example/prometheus",
				Queue:    queueName,
				State:    spec.state,
			},
			Values: buildValues(start, end, step, queueIndex, spec.value),
		}
		result = append(result, series)
	}

	resp := prometheusResponse{
		Status: "success",
		Data: prometheusData{
			ResultType: "matrix",
			Result:     result,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
	}
}

func metricSpecForQuery(query string) (metricSpec, bool) {
	switch {
	case strings.Contains(query, "asynq_queue_size"):
		return metricSpec{
			name: "asynq_queue_size",
			value: func(queueIndex int, sampleIndex int) float64 {
				base := float64((queueIndex % 5) + 1)
				if sampleIndex%9 == queueIndex%9 {
					return 0
				}
				return base + float64((sampleIndex+queueIndex)%4)
			},
		}, true
	case strings.Contains(query, "asynq_queue_latency_seconds"):
		return metricSpec{
			name: "asynq_queue_latency_seconds",
			value: func(queueIndex int, sampleIndex int) float64 {
				return math.Round((0.5+float64(queueIndex)*0.25+math.Sin(float64(sampleIndex+queueIndex))*0.4)*100) / 100
			},
		}, true
	case strings.Contains(query, "asynq_queue_memory_usage_approx_bytes"):
		return metricSpec{
			name: "asynq_queue_memory_usage_approx_bytes",
			value: func(queueIndex int, sampleIndex int) float64 {
				return float64(1024 * (queueIndex + 1) * (sampleIndex%6 + 2))
			},
		}, true
	case strings.Contains(query, "rate(asynq_tasks_failed_total") && strings.Contains(query, "/"):
		return metricSpec{
			name: "asynq_error_rate",
			value: func(queueIndex int, sampleIndex int) float64 {
				processed := 0.8 + float64((sampleIndex+queueIndex)%7)/3
				failed := float64((queueIndex+sampleIndex)%3) / 20
				if processed == 0 {
					return 0
				}
				return math.Round((failed/processed)*1000) / 1000
			},
		}, true
	case strings.Contains(query, "rate(asynq_tasks_processed_total"):
		return metricSpec{
			name: "asynq_tasks_processed_total",
			value: func(queueIndex int, sampleIndex int) float64 {
				return math.Round((0.4+float64((queueIndex+sampleIndex)%10)/6)*1000) / 1000
			},
		}, true
	case strings.Contains(query, "rate(asynq_tasks_failed_total"):
		return metricSpec{
			name: "asynq_tasks_failed_total",
			value: func(queueIndex int, sampleIndex int) float64 {
				if (queueIndex+sampleIndex)%6 == 0 {
					return 0
				}
				return math.Round((float64((queueIndex+sampleIndex)%4)/25)*1000) / 1000
			},
		}, true
	case strings.Contains(query, `asynq_tasks_enqueued_total{state="pending"`):
		return metricSpec{
			name:  "asynq_tasks_enqueued_total",
			state: "pending",
			value: func(queueIndex int, sampleIndex int) float64 {
				return float64((queueIndex*3 + sampleIndex) % 11)
			},
		}, true
	case strings.Contains(query, `asynq_tasks_enqueued_total{state="retry"`):
		return metricSpec{
			name:  "asynq_tasks_enqueued_total",
			state: "retry",
			value: func(queueIndex int, sampleIndex int) float64 {
				if sampleIndex%5 != queueIndex%5 {
					return 0
				}
				return float64((queueIndex % 3) + 1)
			},
		}, true
	case strings.Contains(query, `asynq_tasks_enqueued_total{state="archived"`):
		return metricSpec{
			name:  "asynq_tasks_enqueued_total",
			state: "archived",
			value: func(queueIndex int, sampleIndex int) float64 {
				if sampleIndex < 2 {
					return 0
				}
				return float64((queueIndex + sampleIndex) % 4)
			},
		}, true
	default:
		return metricSpec{}, false
	}
}

func buildValues(start, end, step int64, queueIndex int, valueFn func(queueIndex int, sampleIndex int) float64) [][]interface{} {
	values := make([][]interface{}, 0, int((end-start)/step)+1)
	sampleIndex := 0
	for ts := start; ts <= end; ts += step {
		value := valueFn(queueIndex, sampleIndex)
		values = append(values, []interface{}{ts, formatValue(value)})
		sampleIndex++
	}
	return values
}

func filterQueues(query string) []string {
	matches := queueFilterPattern.FindStringSubmatch(query)
	if len(matches) < 2 {
		return sampleQueues
	}

	allowed := strings.Split(matches[1], "|")
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, queueName := range allowed {
		allowedSet[queueName] = struct{}{}
	}

	filtered := make([]string, 0, len(sampleQueues))
	for _, queueName := range sampleQueues {
		if _, ok := allowedSet[queueName]; ok {
			filtered = append(filtered, queueName)
		}
	}
	return filtered
}

func formatValue(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}
