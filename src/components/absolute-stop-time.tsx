import { useTranslation } from 'react-i18next';

export interface AbsoluteStopTimeProps {
  /** Formatted absolute time text. */
  timeText: string;
  /** Text color derived from the route color. */
  textColor: string;
  /** Whether to render the departure marker suffix next to the time. */
  showDepartureMarker: boolean;
  /** Whether to render the arrival marker suffix next to the time. */
  showArrivalMarker: boolean;
}

export function AbsoluteStopTime({
  timeText,
  showArrivalMarker,
  showDepartureMarker,
  textColor,
}: AbsoluteStopTimeProps) {
  const { t } = useTranslation();

  return (
    <div
      className="text-base font-bold text-[#333] dark:text-gray-100"
      style={{ color: textColor }}
    >
      {timeText}
      {showArrivalMarker && (
        <span className="text-[10px] font-normal opacity-70">
          {t('stopTimeView.arrivingAbsolute')}
        </span>
      )}
      {showDepartureMarker && (
        <span className="text-[10px] font-normal opacity-70">
          {t('stopTimeView.departingAbsolute')}
        </span>
      )}
    </div>
  );
}
