import { useCallback, useState } from 'react';

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

type DialogState = {
  visible: boolean;
  title: string;
  message: string;
  actions?: AppDialogAction[];
};

const initialDialog: DialogState = {
  visible: false,
  title: '',
  message: '',
};

/**
 * Standard AppDialog state: show/hide and optional actions (e.g. login success).
 * For custom flows (confirm with side effects), use setDialog or keep local state.
 */
export function useAppDialog() {
  const [dialog, setDialog] = useState<DialogState>(initialDialog);

  const hideDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const showDialog = useCallback((title: string, message: string, actions?: AppDialogAction[]) => {
    setDialog({ visible: true, title, message, actions });
  }, []);

  return { dialog, hideDialog, showDialog, setDialog };
}
