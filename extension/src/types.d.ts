export type ShowhowRecordingState = {
  serverUrl: string;
  stepCount: number;
  title: string;
  walkthroughId: string;
  windowId: number;
};

export type ShowhowCaptureClickMessage = {
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

export type ShowhowClickCapture = ShowhowCaptureClickMessage["capture"];

export type ShowhowStartRecordingMessage = {
  type: "start-recording";
  recording: ShowhowRecordingState;
};

export type ShowhowStopRecordingMessage = {
  type: "stop-recording";
};

export type ShowhowPingMessage = {
  type: "recording-ping";
};

export type ShowhowStopRecordingResult = {
  editorUrl: string;
  ok: true;
};

export type ShowhowErrorResult = {
  error: string;
  ok: false;
};
