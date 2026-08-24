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
