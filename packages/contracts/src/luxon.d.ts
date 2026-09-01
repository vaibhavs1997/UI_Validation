declare module 'luxon' {
  export class IANAZone {
    static isValidZone(zone: string): boolean;
  }

  export interface DateTime {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly weekday: number;
    readonly zoneName: string;
    readonly isValid: boolean;
    setZone(zone: string): DateTime;
    startOf(unit: 'day'): DateTime;
    plus(values: { days: number }): DateTime;
    toUTC(): DateTime;
    toISO(options?: { suppressMilliseconds?: boolean }): string | null;
  }

  export const DateTime: {
    fromJSDate(value: Date): DateTime;
    fromObject(
      values: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
      },
      options: { zone: string },
    ): DateTime;
  };
}
