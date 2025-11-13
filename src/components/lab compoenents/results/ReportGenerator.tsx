import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, FileText, Printer, Mail, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

interface TestReport {
  id: string;
  sampleId: string;
  patientName: string;
  testName: string;
  status: "draft" | "approved" | "sent";
  createdAt: Date;
  approvedBy?: string;
  hasAbnormalValues: boolean;
  hasCriticalValues: boolean;
}

const ReportGenerator = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handlePreviewPrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  // Fetch completed samples to display as reports
  const [reports, setReports] = useState<TestReport[]>([]);
  // fetch reports from completed samples on mount
  useEffect(() => {
    api
      .get<any[]>("/labtech/samples")
      .then(({ data }) => {
        const completed = (data || []).filter(s => s.status === "completed");
        const mapped: TestReport[] = completed.map(s => ({
          id: `RPT${s._id.substring(s._id.length-4)}`,
          sampleId: s._id,
          patientName: s.patientName,
          testName: s.tests && s.tests.length ? (typeof s.tests[0] === "string" ? (s as any).testNames?.[0] || "" : s.tests[0].name) : "",
          status: "approved", // completed samples considered approved
          createdAt: new Date(s.completedAt || s.updatedAt || s.createdAt),
          approvedBy: s.processedBy || "LabTech",
          hasAbnormalValues: (s.results||[]).some((r:any)=>r.isAbnormal && !r.isCritical),
          hasCriticalValues: (s.results||[]).some((r:any)=>r.isCritical)
        }));
        setReports(mapped);
      })
      .catch(() => setReports([]));
  }, []);


  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "approved": return "bg-green-100 text-green-800";
      case "sent": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filtering for reports (search only)
  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.sampleId ? report.sampleId.toLowerCase().includes(searchTerm.toLowerCase()) : false);
    return matchesSearch;
  });

  const generatePDF = async (reportId: string, mode: 'save' | 'print' = 'save') => {
    // Find the report data
    const report = reports.find(r => r.id === reportId);
    if (!report) return;
    try {
      const [{ jsPDF }, autoTable] = await Promise.all([
        import('jspdf').then(m => ({ jsPDF: m.jsPDF })),
        import('jspdf-autotable').then(m => (m.default ? m.default : m))
      ]);
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      const marginLeft = 40;
      let cursorY = 36;

      // Load branding: prefer hospitalName/Logo, fallback to labSettings
      const settingsRaw = (typeof window !== 'undefined') ? localStorage.getItem('labSettings') : null;
      const labSettings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const hospitalName = (typeof window !== 'undefined' ? (localStorage.getItem('hospitalName') || '') : '') || labSettings?.labName || 'Hospital Laboratory';

      // Fetch sample with results and demographics
      let sampleData: any = null;
      if (report.sampleId) {
        try {
          const { data } = await api.get(`/labtech/samples/${report.sampleId}`);
          sampleData = data;
        } catch {}
      }

      // Compute a fallback sequential Sample # if sampleNumber absent
      let sampleNumberDisplay: string | null = null;
      if (sampleData?.sampleNumber != null) {
        sampleNumberDisplay = String(sampleData.sampleNumber);
      } else if (report.sampleId) {
        try {
          const { data: allSamples } = await api.get(`/labtech/samples`);
          const sorted = (allSamples || []).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const idx = sorted.findIndex((s: any) => String(s._id) === String(report.sampleId));
          if (idx >= 0) sampleNumberDisplay = String(idx + 1);
        } catch {}
      }

      // Optional logo: only use safe URL schemes to avoid file:// errors in Electron
      const storedLogo = localStorage.getItem('hospitalLogoUrl') || localStorage.getItem('labLogoUrl') || '';
      const safeLogo = /^https?:\/\//i.test(storedLogo) || /^data:/i.test(storedLogo) ? storedLogo : '';
      if (safeLogo) {
        try {
          const img = new Image();
          img.src = safeLogo;
          await new Promise(res => { img.onload = () => res(null); img.onerror = () => res(null); });
          if (img.width && img.height) {
            doc.addImage(img, 'PNG', marginLeft, cursorY, 60, 60);
          }
        } catch {}
      }

      // Header: Hospital/Lab name and report title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      // Lab name in green
      doc.setTextColor(34, 139, 34);
      doc.text(hospitalName, marginLeft + 80, cursorY + 24);
      // Reset color for subtitle
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Laboratory Report', marginLeft + 80, cursorY + 44);

      // Right-side reporting timestamp
      doc.setFontSize(10);
      doc.text(`Reporting Time: ${new Date().toLocaleString()}`, 400, cursorY + 16);

      // Patient Details box
      cursorY += 70;
      doc.setDrawColor(200);
      doc.setLineWidth(1);
      const detailsBoxHeight = 110;
      doc.roundedRect(marginLeft, cursorY, 515, detailsBoxHeight, 6, 6);
      const pad = 10;
      let infoY = cursorY + pad + 4;
      const pName = sampleData?.patientName || report.patientName || '-';
      const pAge = (sampleData?.age != null) ? String(sampleData.age) : '-';
      const pSex = (sampleData?.gender != null) ? String(sampleData.gender) : '-';
      const pPhone = sampleData?.phone || '-';
      // Remove email per requirement
      const pAddr = sampleData?.address || '-';
      const pGuardian = (sampleData?.guardianRelation || sampleData?.guardianName)
        ? `${sampleData?.guardianRelation ? String(sampleData.guardianRelation) + ' ' : ''}${sampleData?.guardianName ? String(sampleData.guardianName) : ''}`
        : '-';
      const pCnic = (sampleData?.cnic) ? String(sampleData.cnic) : '-';
      const regDate = (sampleData?.createdAt ? new Date(sampleData.createdAt) : report.createdAt).toLocaleString();
      const sampleId = sampleNumberDisplay || 'N/A';

      // Title
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Details:', marginLeft + pad, infoY);
      // Sample number on the right in the same row
      doc.text('Sample No:', marginLeft + 350, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${sampleId}`, marginLeft + 430, infoY);
      infoY += 16;

      // Two-column layout
      const leftX = marginLeft + pad;
      const rightX = marginLeft + 260; // roughly half width

      doc.setFont('helvetica', 'bold'); doc.text('Name:', leftX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${pName}`, leftX + 38, infoY);
      doc.setFont('helvetica', 'bold'); doc.text('Age/Sex:', rightX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${pAge} / ${pSex}`, rightX + 56, infoY);
      infoY += 16;
      doc.setFont('helvetica', 'bold'); doc.text('Phone:', leftX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${pPhone}`, leftX + 44, infoY);
      doc.setFont('helvetica', 'bold'); doc.text('CNIC:', rightX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${pCnic}`, rightX + 40, infoY);
      infoY += 16;
      doc.setFont('helvetica', 'bold'); doc.text('Guardian:', leftX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${pGuardian}`, leftX + 62, infoY);
      infoY += 16;
      doc.setFont('helvetica', 'bold'); doc.text('Address:', leftX, infoY); doc.setFont('helvetica', 'normal');
      const addrLines = doc.splitTextToSize(` ${pAddr}`, 470);
      doc.text(addrLines, leftX + 52, infoY);
      infoY += 16 + (addrLines.length > 1 ? (addrLines.length - 1) * 12 : 0);
      // Registration line full width
      doc.setFont('helvetica', 'bold'); doc.text('Registration:', leftX, infoY); doc.setFont('helvetica', 'normal'); doc.text(` ${regDate}`, leftX + 72, infoY);

      cursorY += 110;

      // Tests Ordered section
      if (sampleData) {
        const testNames: string[] = (sampleData.tests || []).map((t: any) => (typeof t === 'string' ? '' : (t?.name || ''))).filter((n: string) => n);
        if (testNames.length) {
          doc.setFont('helvetica', 'bold');
          doc.text('Tests Ordered', marginLeft, cursorY);
          doc.setFont('helvetica', 'normal');
          cursorY += 14;
          const listText = testNames.join(', ');
          const splitTests = doc.splitTextToSize(listText, 515);
          doc.text(splitTests, marginLeft, cursorY);
          cursorY += 20 + (splitTests.length > 1 ? (splitTests.length - 1) * 12 : 0);
        }
      }

      // Build results table combining saved results + parameter metadata
      let tableRows: any[] = [];
      if (sampleData) {
        // Fetch all tests for parameter metadata
        const testIds: string[] = (sampleData.tests || []).map((t: any) => (typeof t === 'string' ? t : (t?._id || t?.id))).filter(Boolean);
        let paramMeta: Record<string, any> = {};
        if (testIds.length) {
          try {
            const detailsArrays = await Promise.all(testIds.map(async (tid: string) => {
              const { data: d } = await api.get(`/labtech/tests/${tid}`);
              return (d.parameters || []).map((p: any) => ({
                id: p.id, name: p.name, unit: p.unit,
                normalRange: p.normalRange || { min: undefined, max: undefined },
                normalRangeMale: p.normalRangeMale || p.normalRange_male || null,
                normalRangeFemale: p.normalRangeFemale || p.normalRange_female || null,
                normalRangePediatric: p.normalRangePediatric || p.normalRange_pediatric || null,
              }));
            }));
            detailsArrays.flat().forEach((p: any) => { paramMeta[p.id] = p; });
          } catch {}
        }

        const ageNum = sampleData?.age ? parseFloat(sampleData.age) : NaN;
        const isPediatric = !isNaN(ageNum) && ageNum < 13;
        const sex = (sampleData?.gender || '').toLowerCase();
        const group = isPediatric ? 'pediatric' : (sex.startsWith('f') ? 'female' : (sex.startsWith('m') ? 'male' : '')); 

        const resultsForTable = (sampleData.results || []);

        tableRows = resultsForTable.map((r: any) => {
          const meta = paramMeta[r.parameterId] || {};
          const name = r.label || meta.name || r.parameter || r.name || r.parameterId || '-';
          const unit = r.unit || meta.unit || '-';
          let normalText = r.normalText || '-';
          if (!r.normalText) {
            if (group === 'male' && meta.normalRangeMale) normalText = meta.normalRangeMale;
            else if (group === 'female' && meta.normalRangeFemale) normalText = meta.normalRangeFemale;
            else if (group === 'pediatric' && meta.normalRangePediatric) normalText = meta.normalRangePediatric;
            else if (meta.normalRange && (typeof meta.normalRange.min !== 'undefined' || typeof meta.normalRange.max !== 'undefined')) {
              const parts = [
                typeof meta.normalRange.min === 'number' ? `${meta.normalRange.min}` : '',
                typeof meta.normalRange.max === 'number' ? `${meta.normalRange.max}` : '',
              ].filter(Boolean);
              normalText = parts.length ? parts.join(' - ') : '-';
            }
          }
          const value = (typeof r.value === 'number' || typeof r.value === 'string') ? `${r.value}` : '-';
          const comment = r.comment ? String(r.comment) : '-';
          // Include comment in the same row
          return [name, normalText, unit, value, comment];
        });
      }

      if (!tableRows.length) tableRows = [[report.testName || '-', '-', '-', '-', '-']];

      (autoTable as any)(doc, {
        head: [['Test', 'Normal Value', 'Unit', 'Result', 'Comment']],
        body: tableRows,
        startY: cursorY,
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [255, 255, 255], fontStyle: 'bold', fontSize: 13, textColor: [0, 0, 0] },
        margin: { left: marginLeft, right: marginLeft },
      });

      // Start post-table sections (heading removed as requested)
      let afterTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : cursorY + 20;

      // Render Clinical Interpretation (label + content bold)
      if (sampleData?.interpretation) {
        doc.setFont('helvetica', 'bold');
        doc.text('Clinical Interpretation:', marginLeft, afterTableY);
        afterTableY += 12;
        const splitInterp = doc.splitTextToSize(String(sampleData.interpretation), 515);
        // keep bold for the interpretation content as requested
        doc.setFont('helvetica', 'bold');
        doc.text(splitInterp, marginLeft, afterTableY);
        afterTableY += (splitInterp.length * 12);
      }

      if (mode === 'print') {
        const blob = (doc as any).output('blob');
        const url = URL.createObjectURL(blob);
        setPreviewReady(false);
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
        setPreviewOpen(true);
      } else {
        doc.save(`report-${report.id}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF');
    }
  };

  const sendReport = (reportId: string) => {
    console.log(`Sending report ${reportId}`);
    // This would trigger email/portal delivery
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Report Generator</h1>
          <p className="text-gray-600">Generate and manage test reports</p>
        </div>
      </div>

      {/* Custom Report Modal removed */}

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border rounded-md overflow-hidden text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className="px-3 py-2 border-b">Date</th>
              <th className="px-3 py-2 border-b">Patient</th>
              <th className="px-3 py-2 border-b">Sample ID</th>
              <th className="px-3 py-2 border-b">Test</th>
              <th className="px-3 py-2 border-b">Status</th>
              <th className="px-3 py-2 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => (
              <tr key={report.id} data-report-id={report.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 border-b whitespace-nowrap">{report.createdAt.toLocaleString()}</td>
                <td className="px-3 py-2 border-b">{report.patientName}</td>
                <td className="px-3 py-2 border-b font-mono">{report.sampleId}</td>
                <td className="px-3 py-2 border-b">{report.testName}</td>
                <td className="px-3 py-2 border-b">
                  <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                </td>
                <td className="px-3 py-2 border-b text-right">
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => generatePDF(report.id, 'save')}>
                      <FileText className="w-4 h-4 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => generatePDF(report.id, 'print')}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">No reports found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => { if (open) setPreviewOpen(true); else closePreview(); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0">
          <DialogHeader className="px-6 py-4">
            <DialogTitle>Report Preview</DialogTitle>
          </DialogHeader>
          <div className="px-0">
            {previewUrl && (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-[65vh] border-0"
                onLoad={() => setPreviewReady(true)}
              />
            )}
          </div>
          <DialogFooter className="px-6 py-4">
            <Button onClick={handlePreviewPrint} disabled={!previewReady}>Print</Button>
            <DialogClose asChild>
              <Button variant="outline" onClick={closePreview}>OK</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

// Print handler to print only the selected report card
function handlePrint(reportId: string) {
  // Find the card element for the report
  const card = document.querySelector(`[data-report-id='${reportId}']`);
  if (!card) return;
  const printWindow = window.open('', '', 'width=800,height=600');
  if (!printWindow) return;
  printWindow.document.write('<html><head><title>Print Report</title>');
  // Optionally include styles
  const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'));
  styles.forEach(style => printWindow.document.write(style.outerHTML));
  printWindow.document.write('</head><body>');
  printWindow.document.write(card.outerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

export default ReportGenerator;
