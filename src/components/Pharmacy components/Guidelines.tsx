import React, { useState } from 'react';
import { Command, CommandList, CommandItem, CommandShortcut } from '@/components/ui/command';

export const Guidelines = (_: { isUrdu: boolean }) => {
  type Shortcut = { id: string; action: string; keys: string[]; module: string };

  const [shortcuts] = useState<Shortcut[]>([
    { id: 'open_pos', keys: ['Ctrl', 'N'], action: 'Open POS', module: 'pos' },
    { id: 'open_reports', keys: ['Shift', 'R'], action: 'Open Reports', module: 'reports' },
    { id: 'open_inventory', keys: ['Shift', 'I'], action: 'Open Inventory', module: 'inventory' },
    { id: 'focus_inventory_search', keys: ['Shift', 'F'], action: 'Focus Inventory search', module: 'inventory' },
    { id: 'focus_pos_search', keys: ['Ctrl', 'D'], action: 'Focus POS search', module: 'pos' },
    { id: 'navigate_up', keys: ['Arrow Up'], action: 'Navigate medicines', module: 'inventory' },
    { id: 'navigate_down', keys: ['Arrow Down'], action: 'Navigate medicines', module: 'inventory' },
    { id: 'add_to_cart_enter', keys: ['Enter'], action: 'Add selected to cart', module: 'pos' },
    { id: 'add_to_cart_plus', keys: ['+'], action: 'Add selected to cart', module: 'pos' },
    { id: 'decrease_qty', keys: ['Shift', 'P'], action: 'Decrease selected quantity', module: 'pos' },
    { id: 'process_payment', keys: ['Shift', 'D'], action: 'Process payment', module: 'pos' },
    { id: 'focus_discount', keys: ['Shift', 'N'], action: 'Focus Discount field', module: 'pos' },
    { id: 'focus_customer_name', keys: ['Shift', 'N'], action: 'Focus Customer Name', module: 'pos' },
    { id: 'confirm_payment', keys: ['Shift', 'Enter'], action: 'Confirm Payment', module: 'pos' },
  ]);
  const t = {
    title: 'Guidelines & Shortcuts',
    subtitle: 'How to use this software',
    shortcutsTitle: 'Keyboard Shortcuts',
  } as const;

  return (
    <div className="bg-white/70 dark:bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-6">
      <h3 className="text-sm font-medium mb-2">{t.title}</h3>
      <p className="text-xs text-gray-500 mb-4">{t.subtitle}</p>
      
      <div className="mb-4">
        <h4 className="text-xs font-medium mb-2">{t.shortcutsTitle}</h4>
        <Command>
          <CommandList>
            {shortcuts.map((sc, idx) => (
              <CommandItem key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>{sc.action}</span>
                  <CommandShortcut>{sc.keys.join(' + ')}</CommandShortcut>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </div>
    </div>
  );
};
