type ShowhowRecordingState = {
  serverUrl: string;
  stepCount: number;
  title: string;
  walkthroughId: string;
};

type ShowhowCaptureClickMessage = {
  type: "capture-click";
  capture: {
    clickX: number;
    clickY: number;
    elementLabel: string;
    elementRect: { height: number; width: number; x: number; y: number };
    pageUrl: string;
    viewportHeight: number;
    viewportWidth: number;
  };
};

type ShowhowClickCapture = ShowhowCaptureClickMessage["capture"];

type ShowhowStartRecordingMessage = {
  type: "start-recording";
  recording: ShowhowRecordingState;
};

type ShowhowStopRecordingMessage = {
  type: "stop-recording";
};

type ShowhowPingMessage = {
  type: "recording-ping";
};

type ShowhowStopRecordingResult = {
  editorUrl: string;
  ok: true;
};

type ShowhowErrorResult = {
  error: string;
  ok: false;
};
