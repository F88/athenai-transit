import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorBoundaryFallbackView } from './error-boundary';

const meta = {
  title: 'ErrorBoundary/Fallback',
  component: ErrorBoundaryFallbackView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100dvh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    appTitle: 'Athenai Transit',
    title: '問題が発生しました',
    message:
      'アプリの表示中にエラーが発生しました。再読み込みで回復しない場合は、キャッシュを消去してお試しください。',
    detailLabel: 'エラー詳細',
    errorText: "Cannot read properties of undefined (reading 'headsign')",
    clearCacheLabel: 'キャッシュを消去して再読み込み',
    reloadLabel: '再読み込み',
    isRecovering: false,
    onClearCache: () => {},
    onReload: () => {},
  },
} satisfies Meta<typeof ErrorBoundaryFallbackView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Japanese: Story = {};

export const English: Story = {
  args: {
    title: 'Something went wrong',
    message:
      'An error occurred while displaying the app. If reloading does not help, try clearing the cache.',
    detailLabel: 'Error details',
    errorText: "Cannot read properties of undefined (reading 'headsign')",
    clearCacheLabel: 'Clear cache and reload',
    reloadLabel: 'Reload',
  },
};

export const LongErrorText: Story = {
  args: {
    errorText:
      "TypeError: Cannot read properties of undefined (reading 'departures') at StopTimetable (stop-timetable.tsx:142:18) at renderWithHooks (react-dom.js:11121:18)",
  },
};

export const Recovering: Story = {
  args: {
    isRecovering: true,
  },
};
