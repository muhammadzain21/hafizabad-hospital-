import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ShortStayFormPage32 from '@/components/short stay';

export const ShortStayModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }>=({ open, onOpenChange })=>{
  const printRef = useRef<HTMLDivElement>(null);

  const printView = () => {
    const el = printRef.current; if (!el) return;
    const style = `
      <style>
        @page { size: A4; margin: 12mm; }
        *{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#111}
      </style>`;
    const html = `<!doctype html><html><head><meta charset=\"utf-8\">${style}</head><body>${el.innerHTML}</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Short Stay</DialogTitle>
        </DialogHeader>
        <div ref={printRef}>
          <ShortStayFormPage32 />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={printView}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
