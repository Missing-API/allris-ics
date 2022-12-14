import { VEvent } from "node-ical";

export interface IncomingEvent extends VEvent {
  htmlContent?: string;
  organizerName?: string;
}
