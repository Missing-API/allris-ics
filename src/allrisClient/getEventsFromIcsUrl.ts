import axios from "axios";
import ical from "node-ical";
import { trimHtml } from "./cleanHtml";
import { getUrlFromText } from "./getUrlFromText";

export interface ICal {
  calendar: any;
  events: object[];
}

export const getEventsFromIcsUrl = async (icsUrl: string): Promise<ICal> => {
  // query ics feed
  try {
    const { data } = await axios.get<any>(icsUrl);

    const icsEvents = ical.sync.parseICS(data);

    let calendarInfo: object = {};
    let eventsArray: object[] = [];
    const onlyEvents = Object.values(icsEvents).map((event: any) => {
      if (event.type === "VEVENT") {
        const eventDesc: string =
          typeof event.description === "object"
            ? event.description?.val
            : (event.description as string);

        const eventSummary: string =
          typeof event.summary === "object"
            ? trimHtml(event.summary?.val)
            : trimHtml(event.summary as string);

        const eventLocation: string =
          typeof event.location === "object"
            ? event.location?.val
            : (event.location as string);

        const eventWithUrl: object = {
          ...event,
          summary: eventSummary,
          description: eventDesc,
          location: eventLocation,
          url: getUrlFromText(eventDesc) || undefined,
        };

        if (eventSummary !== "Kalender" && eventSummary !== "Sitzungskalender")
          eventsArray.push(eventWithUrl);
      } else if (event.type === "VCALENDAR") {
        calendarInfo = event;
      }
    });

    const iCal: ICal = {
      calendar: calendarInfo,
      events: eventsArray,
    };
    return iCal;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("error message: ", error.message);
      return Promise.reject(error);
    } else {
      console.error("unexpected error: ", error);
      return Promise.reject(error);
    }
  }
};
