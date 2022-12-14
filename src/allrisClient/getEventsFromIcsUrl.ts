import axios from "axios";
import ical from "node-ical";
import { getUrlFromText } from "./getUrlFromText";

export interface ICal {
  calendar: object;
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
        const eventWithUrl: object = {
          ...event,
          url: getUrlFromText(event.description) || undefined,
        };
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
