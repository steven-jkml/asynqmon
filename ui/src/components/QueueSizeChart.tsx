import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useHistory } from "react-router-dom";
import { useTheme } from "@material-ui/core/styles";
import { queueDetailsPath } from "../paths";

export type QueueSizeStatusKey =
  | "active"
  | "pending"
  | "aggregating"
  | "scheduled"
  | "retry"
  | "archived"
  | "completed";

export const queueSizeSeriesConfig: {
  key: QueueSizeStatusKey;
  label: string;
  fill: string;
}[] = [
  { key: "active", label: "Active", fill: "#1967d2" },
  { key: "pending", label: "Pending", fill: "#669df6" },
  { key: "aggregating", label: "Aggregating", fill: "#e69138" },
  { key: "scheduled", label: "Scheduled", fill: "#fdd663" },
  { key: "retry", label: "Retry", fill: "#f666a9" },
  { key: "archived", label: "Archived", fill: "#ac4776" },
  { key: "completed", label: "Completed", fill: "#4bb543" },
];

interface Props {
  data: TaskBreakdown[];
  visibleSeriesKeys: QueueSizeStatusKey[];
}

interface TaskBreakdown {
  queue: string; // name of the queue.
  active: number; // number of active tasks in the queue.
  pending: number; // number of pending tasks in the queue.
  aggregating: number; // number of aggregating tasks in the queue.
  scheduled: number; // number of scheduled tasks in the queue.
  retry: number; // number of retry tasks in the queue.
  archived: number; // number of archived tasks in the queue.
  completed: number; // number of completed tasks in the queue.
}

function QueueSizeChart(props: Props) {
  const theme = useTheme();
  const handleClick = (params: { activeLabel?: string } | null) => {
    const allQueues = props.data.map((b) => b.queue);
    if (
      params &&
      params.activeLabel &&
      allQueues.includes(params.activeLabel)
    ) {
      history.push(queueDetailsPath(params.activeLabel));
    }
  };
  const history = useHistory();
  return (
    <ResponsiveContainer>
      <BarChart
        data={props.data}
        maxBarSize={120}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="queue" stroke={theme.palette.text.secondary} />
        <YAxis stroke={theme.palette.text.secondary} />
        <Tooltip />
        <Legend />
        {queueSizeSeriesConfig
          .filter((series) => props.visibleSeriesKeys.includes(series.key))
          .map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId="a"
              fill={series.fill}
            />
          ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default QueueSizeChart;
