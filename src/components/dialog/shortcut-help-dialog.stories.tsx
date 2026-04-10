import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShortcutHelpDialog } from './shortcut-help-dialog';

const meta = {
  title: 'Dialog/ShortcutHelpDialog',
  component: ShortcutHelpDialog,
  args: {
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof ShortcutHelpDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
