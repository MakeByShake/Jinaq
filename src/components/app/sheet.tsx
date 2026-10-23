'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Wider dialog on desktop. */
  wide?: boolean;
}

/** Bottom sheet on phones (thumb-friendly), centered dialog on larger screens. */
export function ResponsiveSheet({ open, onOpenChange, title, description, children, footer, className, wide }: ResponsiveSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[94dvh] rounded-t-3xl border-0 bg-card">
          <DrawerHeader className="pb-2 pt-3 text-left">
            <DrawerTitle className="text-lg font-bold">{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : <DrawerDescription className="sr-only">{title}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn('overflow-y-auto px-4 pb-4', className)}>{children}</div>
          {footer && <div className="border-t border-border bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-h-[90dvh] gap-0 overflow-hidden rounded-3xl border-border bg-card p-0', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3 text-left">
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className={cn('max-h-[calc(90dvh-9rem)] overflow-y-auto px-6 pb-6', className)}>{children}</div>
        {footer && <div className="border-t border-border px-6 py-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
