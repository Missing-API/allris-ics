import { IcsEvent } from "../types/icsEvent";
import { IncomingEvent } from "../types/incomingEvent";

export const mapIncomingEventToIcsEvent = (input: IncomingEvent): IcsEvent => {
  // reformat dates
  const startDate: Date = new Date(input.start);
  const icsStartDate = [
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    startDate.getDate(),
    startDate.getHours(),
    startDate.getMinutes(),
  ];

  const endDate: Date = new Date(input.end);
  const icsEndDate = [
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    endDate.getDate(),
    endDate.getHours(),
    endDate.getMinutes(),
  ];

  const icsEvent: IcsEvent = {
    uid: input.uid,
    location: input.location,
    title: input.summary,
    description: input.description,
    // htmlContent: input.description,
    start: icsStartDate,
    startInputType: "local",
    end: icsEndDate,
    endInputType: "local",
    url: input.url,
    method: "PUBLISH",
    organizer: {
      name: input.organizerName || undefined,
    },
    productId: input.organizerName || undefined,
  };

  return icsEvent;
};
