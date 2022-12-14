export interface IcsEvent {
  uid: string;
  location: string;
  title: string;
  description: string;
  htmlContent?: string;
  start: number[];
  startInputType: "local";
  end: number[];
  endInputType: "local";
  url: string;
  method: "PUBLISH";
  organizer: { name: string; email?: string };
  categories?: string[];
  productId?: string;
}
