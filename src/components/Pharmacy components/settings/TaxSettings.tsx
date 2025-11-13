// TaxSettings is now deprecated. Please use the main Settings page for all tax-related configuration.
export function TaxSettings() {
  const [taxConfig, setTaxConfig] = useState(taxService.getTaxConfig());
  const { toast } = useToast();

  const handleSave = () => {
    try {
      taxService.updateTaxConfig(taxConfig);
      toast({
        title: 'Tax Settings Saved',
        description: 'Your tax configuration has been updated',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not update tax settings',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch 
          id="tax-enabled" 
          checked={taxConfig.enabled}
          onCheckedChange={(enabled) => setTaxConfig({...taxConfig, enabled})}
        />
        <Label htmlFor="tax-enabled">Enable Tax</Label>
      </div>

      {taxConfig.enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input 
              id="tax-rate" 
              type="number" 
              value={taxConfig.rate * 100}
              onChange={(e) => setTaxConfig({
                ...taxConfig, 
                rate: parseFloat(e.target.value) / 100
              })}
            />
          </div>

          <div className="space-y-2">
            <Label>Tax Type</Label>
            <Select
              value={taxConfig.inclusive ? 'inclusive' : 'exclusive'}
              onValueChange={(value) => setTaxConfig({
                ...taxConfig, 
                inclusive: value === 'inclusive'
              })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select tax type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive">Inclusive</SelectItem>
                <SelectItem value="exclusive">Exclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <Button onClick={handleSave}>Save Tax Settings</Button>
    </div>
  );
}
