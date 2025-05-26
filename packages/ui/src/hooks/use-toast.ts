import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function useToast() {
  const toast = ({ title, description, action }: ToastProps) => {
    sonnerToast(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    });
  };

  return {
    toast,
    success: (title: string, description?: string) =>
      sonnerToast.success(title, { description }),
    error: (title: string, description?: string) =>
      sonnerToast.error(title, { description }),
    warning: (title: string, description?: string) =>
      sonnerToast.warning(title, { description }),
    info: (title: string, description?: string) =>
      sonnerToast.info(title, { description }),
  };
}
