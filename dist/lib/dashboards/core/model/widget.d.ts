export declare type WidgetType = 'text' | 'metric' | 'log';
export declare type Widget = {
    type: WidgetType;
    width: number;
    height: number;
    properties: any;
};
