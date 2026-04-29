import React, { useEffect, useState } from "react";
import { connect, ConnectedProps } from "react-redux";
import Container from "@material-ui/core/Container";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormGroup from "@material-ui/core/FormGroup";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import InfoIcon from "@material-ui/icons/Info";
import FilterListIcon from "@material-ui/icons/FilterList";
import Alert from "@material-ui/lab/Alert";
import AlertTitle from "@material-ui/lab/AlertTitle";
import {
  listQueuesAsync,
  pauseQueueAsync,
  resumeQueueAsync,
  deleteQueueAsync,
} from "../actions/queuesActions";
import { listQueueStatsAsync } from "../actions/queueStatsActions";
import {
  dailyStatsKeyChange,
  queueSizeVisibleSeriesChange,
} from "../actions/settingsActions";
import { AppState } from "../store";
import QueueSizeChart, {
  queueSizeSeriesConfig,
  QueueSizeStatusKey,
} from "../components/QueueSizeChart";
import ProcessedTasksChart from "../components/ProcessedTasksChart";
import QueuesOverviewTable from "../components/QueuesOverviewTable";
import Tooltip from "../components/Tooltip";
import SplitButton from "../components/SplitButton";
import { usePolling } from "../hooks";
import DailyStatsChart from "../components/DailyStatsChart";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
  chartHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(2),
  },
  chartHeaderTitle: {
    display: "flex",
    alignItems: "center",
  },
  chartContainer: {
    width: "100%",
    height: "300px",
  },
  infoIcon: {
    marginLeft: theme.spacing(1),
    color: theme.palette.grey[500],
    cursor: "pointer",
  },
  tooltipSection: {
    marginBottom: "4px",
  },
  tableContainer: {
    marginBottom: theme.spacing(2),
  },
  filterButton: {
    marginLeft: theme.spacing(1),
  },
  popoverContent: {
    padding: theme.spacing(2),
  },
}));

function mapStateToProps(state: AppState) {
  return {
    loading: state.queues.loading,
    queues: state.queues.data.map((q) => ({
      ...q.currentStats,
      requestPending: q.requestPending,
    })),
    error: state.queues.error,
    pollInterval: state.settings.pollInterval,
    queueStats: state.queueStats.data,
    dailyStatsKey: state.settings.dailyStatsChartType,
    visibleQueueSizeSeries: state.settings.queueSizeVisibleSeries,
  };
}

const mapDispatchToProps = {
  listQueuesAsync,
  pauseQueueAsync,
  resumeQueueAsync,
  deleteQueueAsync,
  listQueueStatsAsync,
  dailyStatsKeyChange,
  queueSizeVisibleSeriesChange,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export type DailyStatsKey = "today" | "last-7d" | "last-30d" | "last-90d";
export const defaultDailyStatsKey = "last-7d";

export function DashboardView(props: Props) {
  const {
    pollInterval,
    listQueuesAsync,
    queues,
    listQueueStatsAsync,
    dailyStatsKey,
    visibleQueueSizeSeries,
  } = props;
  const classes = useStyles();
  const [queueSizeFilterAnchor, setQueueSizeFilterAnchor] =
    useState<HTMLElement | null>(null);

  usePolling(listQueuesAsync, pollInterval);

  // Refetch queue stats if a queue is added or deleted.
  const qnames = queues
    .map((q) => q.queue)
    .sort()
    .join(",");

  useEffect(() => {
    listQueueStatsAsync();
  }, [listQueueStatsAsync, qnames]);

  const processedStats = queues.map((q) => ({
    queue: q.queue,
    succeeded: q.processed - q.failed,
    failed: q.failed,
  }));

  const handleQueueSizeFilterClose = () => {
    setQueueSizeFilterAnchor(null);
  };

  const handleQueueSizeSeriesToggle = (seriesKey: QueueSizeStatusKey) => {
    props.queueSizeVisibleSeriesChange(
      visibleQueueSizeSeries.includes(seriesKey)
        ? visibleQueueSizeSeries.filter((key) => key !== seriesKey)
        : queueSizeSeriesConfig
            .map((series) => series.key)
            .filter(
              (key) => key === seriesKey || visibleQueueSizeSeries.includes(key)
            )
    );
  };
  const allQueueSizeSeries = queueSizeSeriesConfig.map((series) => series.key);
  const allQueueSizeSeriesSelected =
    visibleQueueSizeSeries.length === allQueueSizeSeries.length;
  const someQueueSizeSeriesSelected =
    visibleQueueSizeSeries.length > 0 && !allQueueSizeSeriesSelected;

  const handleToggleAllQueueSizeSeries = () => {
    props.queueSizeVisibleSeriesChange(
      allQueueSizeSeriesSelected ? [] : allQueueSizeSeries
    );
  };

  return (
    <Container maxWidth="lg" className={classes.container}>
      <Grid container spacing={3}>
        {props.error.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="error">
              <AlertTitle>Error</AlertTitle>
              Could not retrieve queues live data —{" "}
              <strong>See the logs for details</strong>
            </Alert>
          </Grid>
        )}
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper} variant="outlined">
            <div className={classes.chartHeader}>
              <div className={classes.chartHeaderTitle}>
                <Typography variant="h6">Queue Size</Typography>
                <Tooltip title="Filter queue size statuses">
                  <IconButton
                    aria-label="filter queue size statuses"
                    size="small"
                    onClick={(event) =>
                      setQueueSizeFilterAnchor(event.currentTarget)
                    }
                    className={classes.filterButton}
                  >
                    <FilterListIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    <div>
                      <div className={classes.tooltipSection}>
                        Total number of tasks in the queue
                      </div>
                      <div className={classes.tooltipSection}>
                        <strong>Active</strong>: number of tasks currently being
                        processed
                      </div>
                      <div className={classes.tooltipSection}>
                        <strong>Pending</strong>: number of tasks ready to be
                        processed
                      </div>
                      <div className={classes.tooltipSection}>
                        <strong>Scheduled</strong>: number of tasks scheduled to
                        be processed in the future
                      </div>
                      <div className={classes.tooltipSection}>
                        <strong>Retry</strong>: number of tasks scheduled to be
                        retried in the future
                      </div>
                      <div>
                        <strong>Archived</strong>: number of tasks exhausted
                        their retries
                      </div>
                    </div>
                  }
                >
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
            </div>
            <Popover
              id={
                queueSizeFilterAnchor ? "queue-size-status-filter-popover" : undefined
              }
              open={Boolean(queueSizeFilterAnchor)}
              anchorEl={queueSizeFilterAnchor}
              onClose={handleQueueSizeFilterClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "center",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "center",
              }}
            >
              <div className={classes.popoverContent}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        color="primary"
                        checked={allQueueSizeSeriesSelected}
                        indeterminate={someQueueSizeSeriesSelected}
                        onChange={handleToggleAllQueueSizeSeries}
                        name="select-all-queue-size-statuses"
                      />
                    }
                    label="Select all"
                  />
                  {queueSizeSeriesConfig.map((series) => (
                    <FormControlLabel
                      key={series.key}
                      control={
                        <Checkbox
                          size="small"
                          color="primary"
                          checked={visibleQueueSizeSeries.includes(series.key)}
                          onChange={() =>
                            handleQueueSizeSeriesToggle(series.key)
                          }
                          name={series.key}
                        />
                      }
                      label={series.label}
                    />
                  ))}
                </FormGroup>
              </div>
            </Popover>
            <div className={classes.chartContainer}>
              <QueueSizeChart
                data={queues}
                visibleSeriesKeys={visibleQueueSizeSeries}
              />
            </div>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6} >
          <Paper className={classes.paper} variant="outlined">
            <div className={classes.chartHeader}>
              <div className={classes.chartHeaderTitle}>
                <Typography variant="h6">Tasks Processed</Typography>
                <Tooltip
                  title={
                    <div>
                      <div className={classes.tooltipSection}>
                        Total number of tasks processed in a given day (UTC)
                      </div>
                      <div className={classes.tooltipSection}>
                        <strong>Succeeded</strong>: number of tasks successfully
                        processed
                      </div>
                      <div>
                        <strong>Failed</strong>: number of tasks failed to be
                        processed
                      </div>
                    </div>
                  }
                >
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <div>
                <SplitButton
                  options={[
                    { label: "Today", key: "today" },
                    { label: "Last 7d", key: "last-7d" },
                    { label: "Last 30d", key: "last-30d" },
                    { label: "Last 90d", key: "last-90d" },
                  ]}
                  initialSelectedKey={dailyStatsKey}
                  onSelect={(key) =>
                    props.dailyStatsKeyChange(key as DailyStatsKey)
                  }
                />
              </div>
            </div>
            <div className={classes.chartContainer}>
              {dailyStatsKey === "today" && (
                <ProcessedTasksChart data={processedStats} />
              )}
              {dailyStatsKey === "last-7d" && (
                <DailyStatsChart data={props.queueStats} numDays={7} />
              )}
              {dailyStatsKey === "last-30d" && (
                <DailyStatsChart data={props.queueStats} numDays={30} />
              )}
              {dailyStatsKey === "last-90d" && (
                <DailyStatsChart data={props.queueStats} numDays={90} />
              )}
            </div>
          </Paper>
        </Grid>

        <Grid item xs={12} className={classes.tableContainer}>
          <Paper className={classes.paper} variant="outlined">
            {/* TODO: Add loading indicator  */}
            <QueuesOverviewTable
              queues={queues}
              onPauseClick={props.pauseQueueAsync}
              onResumeClick={props.resumeQueueAsync}
              onDeleteClick={props.deleteQueueAsync}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default connector(DashboardView);
