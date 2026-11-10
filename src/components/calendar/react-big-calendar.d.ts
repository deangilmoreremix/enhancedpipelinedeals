// Minimal local typings for react-big-calendar (no @types package is installed).
declare module 'react-big-calendar' {
  import * as React from 'react';

  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: 'select' | 'click' | 'doubleClick';
  }

  export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

  export interface DateLocalizer {
    format: (...args: unknown[]) => string;
  }

  export interface CalendarProps<TEvent extends object = object> {
    localizer: DateLocalizer;
    events: TEvent[];
    startAccessor?: keyof TEvent | ((event: TEvent) => Date);
    endAccessor?: keyof TEvent | ((event: TEvent) => Date);
    style?: React.CSSProperties;
    eventPropGetter?: (
      event: TEvent,
      start: Date,
      end: Date,
      isSelected: boolean
    ) => { className?: string; style?: React.CSSProperties };
    onSelectEvent?: (event: TEvent, e: React.SyntheticEvent<HTMLElement>) => void;
    onSelectSlot?: (slotInfo: SlotInfo) => void;
    views?: View[];
    defaultView?: View;
    selectable?: boolean | 'ignoreEvents';
    [key: string]: unknown;
  }

  export class Calendar<TEvent extends object = object> extends React.Component<CalendarProps<TEvent>> {}

  export function dateFnsLocalizer(config: {
    format: (...args: never[]) => string;
    parse: (...args: never[]) => Date;
    startOfWeek: (...args: never[]) => Date;
    getDay: (date: Date) => number;
    locales: Record<string, unknown>;
  }): DateLocalizer;
}
