// Written by scripts/build-bus-stops.mjs from 대전광역시_시내버스 기반정보 (공공데이터포털).
// The register lists stops, not routes; it carries no low-floor information.
export type BusStop={id:string;name:string;district:string;dong:string;arrivalDisplay:boolean;lon:number;lat:number};
export type BusStopSnapshot={source:string;note:string;collectedAt:string;counts:Record<string,number>;stops:BusStop[]};
