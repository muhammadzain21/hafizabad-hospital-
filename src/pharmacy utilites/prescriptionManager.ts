
export interface Prescription {
  id: string;
  patientName: string;
  patientAge: number;
  patientGender: 'Male' | 'Female';
  doctorName: string;
  doctorLicense: string;
  hospitalName: string;
  prescriptionDate: string;
  medicines: PrescriptionMedicine[];
  diagnosis: string;
  instructions: string;
  status: 'pending' | 'partial' | 'completed';
  customerId?: string;
  dispensedBy?: string;
  dispensedDate?: string;
  imageUrl?: string;
}

export interface PrescriptionMedicine {
  name: string;
  genericName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  dispensed: number;
  instructions: string;
}

class PrescriptionManager {
  private storageKey = 'pharmacy_prescriptions';

  getAllPrescriptions(): Prescription[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  savePrescription(prescription: Prescription): boolean {
    try {
      const prescriptions = this.getAllPrescriptions();
      const existingIndex = prescriptions.findIndex(p => p.id === prescription.id);
      
      if (existingIndex >= 0) {
        prescriptions[existingIndex] = prescription;
      } else {
        prescriptions.push(prescription);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(prescriptions));
      return true;
    } catch {
      return false;
    }
  }

  getPrescription(id: string): Prescription | null {
    const prescriptions = this.getAllPrescriptions();
    return prescriptions.find(p => p.id === id) || null;
  }

  getCustomerPrescriptions(customerId: string): Prescription[] {
    const prescriptions = this.getAllPrescriptions();
    return prescriptions.filter(p => p.customerId === customerId);
  }

  dispenseMedicine(prescriptionId: string, medicineIndex: number, quantity: number): boolean {
    try {
      const prescription = this.getPrescription(prescriptionId);
      if (!prescription) return false;

      if (medicineIndex < 0 || medicineIndex >= prescription.medicines.length) return false;

      const medicine = prescription.medicines[medicineIndex];
      if (medicine.dispensed + quantity > medicine.quantity) return false;

      medicine.dispensed += quantity;
      
      // Update prescription status
      const allDispensed = prescription.medicines.every(m => m.dispensed === m.quantity);
      const partiallyDispensed = prescription.medicines.some(m => m.dispensed > 0);
      
      if (allDispensed) {
        prescription.status = 'completed';
        prescription.dispensedDate = new Date().toISOString();
      } else if (partiallyDispensed) {
        prescription.status = 'partial';
      }

      return this.savePrescription(prescription);
    } catch {
      return false;
    }
  }

  searchPrescriptions(searchTerm: string): Prescription[] {
    const prescriptions = this.getAllPrescriptions();
    const term = searchTerm.toLowerCase();
    
    return prescriptions.filter(p => 
      p.patientName.toLowerCase().includes(term) ||
      p.doctorName.toLowerCase().includes(term) ||
      p.hospitalName.toLowerCase().includes(term) ||
      p.diagnosis.toLowerCase().includes(term) ||
      p.medicines.some(m => 
        m.name.toLowerCase().includes(term) ||
        m.genericName.toLowerCase().includes(term)
      )
    );
  }

  getPendingPrescriptions(): Prescription[] {
    return this.getAllPrescriptions().filter(p => p.status === 'pending');
  }

  getExpiringPrescriptions(days: number = 30): Prescription[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.getAllPrescriptions().filter(p => {
      const prescriptionDate = new Date(p.prescriptionDate);
      return prescriptionDate >= cutoffDate && p.status !== 'completed';
    });
  }

  validateDoctorLicense(license: string): boolean {
    // In a real app, this would validate against DRAP database
    // For now, we'll do basic format validation
    const licensePattern = /^[A-Z]{2}\d{4,6}$/;
    return licensePattern.test(license);
  }

  generatePrescriptionReport(prescriptions: Prescription[]) {
    const total = prescriptions.length;
    const completed = prescriptions.filter(p => p.status === 'completed').length;
    const pending = prescriptions.filter(p => p.status === 'pending').length;
    const partial = prescriptions.filter(p => p.status === 'partial').length;
    
    const topMedicines = this.getTopPrescribedMedicines(prescriptions);
    const topDoctors = this.getTopPrescribingDoctors(prescriptions);
    
    return {
      summary: {
        total,
        completed,
        pending,
        partial,
        completionRate: total > 0 ? (completed / total * 100).toFixed(1) : '0'
      },
      topMedicines,
      topDoctors
    };
  }

  private getTopPrescribedMedicines(prescriptions: Prescription[]) {
    const medicineCount: { [key: string]: number } = {};
    
    prescriptions.forEach(p => {
      p.medicines.forEach(m => {
        medicineCount[m.name] = (medicineCount[m.name] || 0) + m.quantity;
      });
    });
    
    return Object.entries(medicineCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  private getTopPrescribingDoctors(prescriptions: Prescription[]) {
    const doctorCount: { [key: string]: number } = {};
    
    prescriptions.forEach(p => {
      doctorCount[p.doctorName] = (doctorCount[p.doctorName] || 0) + 1;
    });
    
    return Object.entries(doctorCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  deletePrescription(id: string): boolean {
    try {
      const prescriptions = this.getAllPrescriptions();
      const filtered = prescriptions.filter(p => p.id !== id);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }
}

export const prescriptionManager = new PrescriptionManager();
