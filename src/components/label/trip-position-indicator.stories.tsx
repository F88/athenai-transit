import type { Meta, StoryObj } from '@storybook/react-vite';
import type { InfoLevel } from '../../types/app/settings';
import { TripPositionIndicator, type TripPositionIndicatorSize } from './trip-position-indicator';

const meta = {
  title: 'Label/TripPositionIndicator',
  component: TripPositionIndicator,
  argTypes: {
    stopIndex: { control: { type: 'number', min: 0 } },
    totalStops: { control: { type: 'number', min: 0 } },
    size: { control: 'select', options: ['xs', 'sm', 'md'] },
    infoLevel: {
      control: 'select',
      options: [undefined, 'simple', 'normal', 'detailed', 'verbose'],
    },
    showTrack: { control: 'boolean' },
    currentColor: { control: 'color' },
    dotColor: { control: 'color' },
    trackColor: { control: 'color' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TripPositionIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: middle position of a 5-stop pattern. */
export const Default: Story = {
  args: { stopIndex: 2, totalStops: 5 },
};

/** Origin (first stop). */
export const Origin: Story = {
  args: { stopIndex: 0, totalStops: 5 },
};

/** Terminal (last stop). */
export const Terminal: Story = {
  args: { stopIndex: 4, totalStops: 5 },
};

/**
 * Single-stop edge case — component returns null (hidden).
 *
 * A 1-stop pattern has no positional context to convey (there is no
 * "next" or "previous"), so the indicator opts out instead of
 * rendering a lone highlighted dot with a meaningless aria-label.
 */
export const SingleStop: Story = {
  args: { stopIndex: 0, totalStops: 1 },
};

/**
 * Two-stop pattern — both positions side by side.
 *
 * Shows `0 / 2` (origin) and `1 / 2` (terminal) together so the
 * boundary rendering of a minimum-viable pattern is easy to compare.
 */
export const TwoStops: Story = {
  args: { stopIndex: 0, totalStops: 2 },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-500">0 / 2 (origin)</div>
        <TripPositionIndicator {...args} stopIndex={0} totalStops={2} />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-500">1 / 2 (terminal)</div>
        <TripPositionIndicator {...args} stopIndex={1} totalStops={2} />
      </div>
    </div>
  ),
};

/**
 * Long pattern (39 stops, matching 都営大江戸線 p72) — three positions.
 *
 * Shows origin (`0 / 39`), the 6-shape mid-pass-through (`28 / 39`
 * = 都庁前 second visit), and terminal (`38 / 39` = 光が丘) side by
 * side. Useful for eyeballing dot-density and highlight placement
 * in a realistic long pattern.
 */
export const LongPattern: Story = {
  args: { stopIndex: 28, totalStops: 39 },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-500">0 / 39 (origin, 都庁前)</div>
        <TripPositionIndicator {...args} stopIndex={0} totalStops={39} />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-500">
          28 / 39 (6-shape mid-pass, 都庁前 second visit)
        </div>
        <TripPositionIndicator {...args} stopIndex={28} totalStops={39} />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-gray-500">38 / 39 (terminal, 光が丘)</div>
        <TripPositionIndicator {...args} stopIndex={38} totalStops={39} />
      </div>
    </div>
  ),
};

/** Zero totalStops — component returns null. */
export const ZeroStops: Story = {
  args: { stopIndex: 0, totalStops: 0 },
};

/**
 * Negative totalStops — component returns null (hidden).
 *
 * Defensive: a negative count is a data bug. The component early-returns
 * before the dot loop so nothing renders.
 */
export const NegativeStops: Story = {
  args: { stopIndex: 0, totalStops: -1 },
};

/**
 * Infinity totalStops — component returns null (hidden).
 *
 * Critical defense: without the `Number.isFinite` guard, `Infinity`
 * would send the dot loop into an infinite spin and lock the browser.
 * The story exists mainly to prove that this input is handled safely.
 */
export const InfiniteStops: Story = {
  args: { stopIndex: 0, totalStops: Number.POSITIVE_INFINITY },
};

/**
 * NaN totalStops — component returns null (hidden).
 *
 * `NaN <= 0` is false, so the original guard alone would let it through.
 * `Number.isFinite(NaN)` is false, which catches the case before it
 * reaches the dot loop.
 */
export const NaNStops: Story = {
  args: { stopIndex: 0, totalStops: Number.NaN },
};

/**
 * Very large totalStops (2000) — clamped to MAX_STOPS (300).
 *
 * Real GTFS patterns top out around 80 stops (都営梅70, 京都市バス11).
 * A value beyond 300 signals a data bug (NaN, Infinity, corrupted
 * length). The component clamps to 300 so rendering stays tractable
 * instead of stressing the browser with thousands of DOM nodes.
 *
 * `stopIndex: 150` stays within the clamped range so the current dot
 * is still highlighted.
 */
export const ClampedAboveMax: Story = {
  args: { stopIndex: 150, totalStops: 2000 },
};

/** Without the track line behind the dots. */
export const NoTrack: Story = {
  args: { stopIndex: 2, totalStops: 5, showTrack: false },
};

/** Custom colors from a GTFS `route_color` (Toei Oedo). */
export const CustomColors: Story = {
  args: {
    stopIndex: 2,
    totalStops: 5,
    currentColor: '#cf3366',
    dotColor: '#cf336650',
    trackColor: '#cf336620',
  },
};

/** Hidden at the simplest info verbosity level. */
export const HiddenAtSimple: Story = {
  args: { stopIndex: 2, totalStops: 5, infoLevel: 'simple' },
};

/**
 * All three sizes side by side.
 *
 * Lets the reader compare the visual weight of `xs`, `sm`, and `md`
 * at a glance. The component owns an intentional size contract —
 * `md` uses a taller track with smaller dot markers, while `sm`
 * uses a prominent highlighted dot — so the variants are not a
 * strict monotonic scale.
 */
export const AllSizes: Story = {
  args: { stopIndex: 2, totalStops: 5 },
  render: ({ stopIndex, totalStops, ...rest }) => {
    const sizes: TripPositionIndicatorSize[] = ['xs', 'sm', 'md'];
    return (
      <div className="flex flex-col gap-4">
        {sizes.map((size) => (
          <div key={size}>
            <div className="mb-1 text-xs font-semibold text-gray-500">{size}</div>
            <TripPositionIndicator
              {...rest}
              size={size}
              stopIndex={stopIndex}
              totalStops={totalStops}
            />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * All info levels side by side.
 *
 * `simple` returns null (hidden). `normal` / `detailed` / `verbose`
 * all render, but consumers may adjust `size` based on level.
 */
export const AllInfoLevels: Story = {
  args: { stopIndex: 2, totalStops: 5 },
  render: ({ stopIndex, totalStops, ...rest }) => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    return (
      <div className="flex flex-col gap-4">
        {levels.map((level) => (
          <div key={level}>
            <div className="mb-1 text-xs font-semibold text-gray-500">{level}</div>
            <TripPositionIndicator
              {...rest}
              infoLevel={level}
              stopIndex={stopIndex}
              totalStops={totalStops}
            />
          </div>
        ))}
      </div>
    );
  },
};

/**
 * Position sweep: 0, 1, 2, ..., N-1 for the same pattern length.
 *
 * Scans the current dot from origin to terminal so structural
 * artifacts (off-by-one, alignment at boundaries) are easy to spot.
 */
export const PositionSweep: Story = {
  args: { stopIndex: 0, totalStops: 7 },
  render: ({ totalStops, ...rest }) => (
    <div className="flex flex-col gap-4">
      {Array.from({ length: totalStops }, (_, i) => (
        <div key={i}>
          <div className="mb-1 text-xs font-semibold text-gray-500">
            stopIndex={i} / totalStops={totalStops}
          </div>
          <TripPositionIndicator {...rest} stopIndex={i} totalStops={totalStops} />
        </div>
      ))}
    </div>
  ),
};

interface PatternSample {
  label: string;
  totalStops: number;
  stopIndex: number;
}

interface ColorSample {
  label: string;
  currentColor?: string;
  dotColor?: string;
  trackColor?: string;
}

const patternSamples: PatternSample[] = [
  { label: '0 of 0 (empty → null)', totalStops: 0, stopIndex: 0 },
  { label: '1 of 1 (single stop)', totalStops: 1, stopIndex: 0 },
  { label: '1 of 2 (origin of 2)', totalStops: 2, stopIndex: 0 },
  { label: '2 of 2 (terminal of 2)', totalStops: 2, stopIndex: 1 },
  { label: '1 of 5 (origin)', totalStops: 5, stopIndex: 0 },
  { label: '3 of 5 (middle)', totalStops: 5, stopIndex: 2 },
  { label: '5 of 5 (terminal)', totalStops: 5, stopIndex: 4 },
  { label: '1 of 39 (long, origin)', totalStops: 39, stopIndex: 0 },
  { label: '29 of 39 (6-shape mid-pass)', totalStops: 39, stopIndex: 28 },
  { label: '39 of 39 (long, terminal)', totalStops: 39, stopIndex: 38 },
];

const colorSamples: ColorSample[] = [
  { label: 'default Tailwind' },
  {
    label: 'Oedo #cf3366',
    currentColor: '#cf3366',
    dotColor: '#cf336650',
    trackColor: '#cf336620',
  },
  {
    label: 'Mita #0067b0',
    currentColor: '#0067b0',
    dotColor: '#0067b050',
    trackColor: '#0067b020',
  },
  {
    label: 'Asakusa #ff535f',
    currentColor: '#ff535f',
    dotColor: '#ff535f50',
    trackColor: '#ff535f20',
  },
];

/**
 * All size × position × color combinations in one grid.
 *
 * The matrix walks every size variant across representative
 * patterns (short / long / 6-shape mid-pass-through) and color
 * schemes (default + 3 GTFS route_color samples). Lets the reader
 * spot visual anomalies (alignment drift, color mixing, size
 * inversions) at a glance without clicking through individual
 * stories.
 */
export const KitchenSink: Story = {
  args: { stopIndex: 0, totalStops: 5 },
  render: () => {
    const sizes: TripPositionIndicatorSize[] = ['xs', 'sm', 'md'];
    const renderGroup = (title: string, samples: ColorSample[]) => (
      <div>
        <div className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">{title}</div>
        <div className="flex flex-col gap-4">
          {sizes.map((size) => (
            <div key={size}>
              <div className="mb-1 text-xs font-semibold text-gray-500">size={size}</div>
              <div className="flex flex-col gap-2">
                {samples.map((color) => (
                  <div key={color.label}>
                    <div className="text-[10px] text-gray-400">{color.label}</div>
                    <div className="flex flex-col gap-1">
                      {patternSamples.map((pattern) => (
                        <div key={pattern.label} className="flex items-center gap-2">
                          <span className="w-36 text-[10px] text-gray-500">{pattern.label}</span>
                          <div style={{ width: 240 }}>
                            <TripPositionIndicator
                              size={size}
                              stopIndex={pattern.stopIndex}
                              totalStops={pattern.totalStops}
                              currentColor={color.currentColor}
                              dotColor={color.dotColor}
                              trackColor={color.trackColor}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div style={{ width: 'auto' }} className="flex flex-col gap-6">
        {renderGroup('size × pattern × color (all combinations)', colorSamples)}
      </div>
    );
  },
};
