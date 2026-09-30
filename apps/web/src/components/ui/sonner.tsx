import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: '!rounded-md !border !border-border-strong !bg-raised !text-foreground !shadow-popover !font-sans !text-13',
          description: '!text-muted',
        },
      }}
      {...props}
    />
  );
}
