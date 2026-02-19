export type CaptureEventType = "url" | "text" | "file";

export interface CaptureEventPayload {
  type: CaptureEventType;
  value?: string;
  filename?: string;
}

export type CaptureEventHandler = (payload: CaptureEventPayload) => void;

const EVENT_NAME = "rehilo:capture";

export function subscribeCaptureEvents(handler: CaptureEventHandler) {
  const eventListener = (event: Event) => {
    const custom = event as CustomEvent<CaptureEventPayload>;
    if (!custom.detail) {
      return;
    }
    handler(custom.detail);
  };

  const messageListener = (event: MessageEvent) => {
    const payload = event.data;
    if (!payload || payload.source !== "rehilo-extension") {
      return;
    }
    handler(payload as CaptureEventPayload);
  };

  window.addEventListener(EVENT_NAME, eventListener as EventListener);
  window.addEventListener("message", messageListener);

  return () => {
    window.removeEventListener(EVENT_NAME, eventListener as EventListener);
    window.removeEventListener("message", messageListener);
  };
}
