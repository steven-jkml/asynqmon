# Sample Prometheus Server

Server ini meniru sebagian kecil API Prometheus yang dibutuhkan `asynqmon` untuk tab `Metrics`.

## Run

```bash
go run ./test/example/prometheus
```

Default address:

```text
http://localhost:9090
```

## Test with asynqmon

Jalankan `asynqmon` dan arahkan `PrometheusAddress` ke server sample ini:

```bash
./asynqmon --prometheus-addr=http://localhost:9090
```

Kalau ingin port lain:

```bash
go run ./test/example/prometheus --port=9191
./asynqmon --prometheus-addr=http://localhost:9191
```

## Notes

- Endpoint yang disediakan: `GET /api/v1/query_range`
- Queue filter `queues=` dari UI didukung
- Data yang dikembalikan bersifat sintetis dan dibuat untuk testing tampilan chart dan tooltip
