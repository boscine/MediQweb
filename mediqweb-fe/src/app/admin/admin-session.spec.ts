import { TestBed } from '@angular/core/testing';
import { AdminSession, type StaffKind } from './admin-session';
import {
  MOCK_AUDIT_ENTRIES,
  MOCK_DOCTORS,
  MOCK_PATIENTS,
  MOCK_SECRETARIES,
  MOCK_SPECIALIZATIONS,
} from './admin.mock-data';

describe('AdminSession', () => {
  let session: AdminSession;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
  });

  it('starts from the sample data', () => {
    expect(session.doctors().length).toBe(MOCK_DOCTORS.length);
    expect(session.secretaries().length).toBe(MOCK_SECRETARIES.length);
    expect(session.patients().length).toBe(MOCK_PATIENTS.length);
    expect(session.specializations().length).toBe(MOCK_SPECIALIZATIONS.length);
  });

  it('counts only active accounts', () => {
    const active = MOCK_DOCTORS.filter((d) => d.status === 'active').length;
    expect(session.activeDoctorCount()).toBe(active);
    // The sample data deliberately contains a disabled account, so the count
    // must be lower than the total or this proves nothing.
    expect(active).toBeLessThan(MOCK_DOCTORS.length);
  });

  it('resolves a specialization name and falls back rather than throwing', () => {
    expect(session.specializationName('spec-cardio')).toBe('Cardiology');
    expect(session.specializationName('does-not-exist')).toBe('Unknown');
    expect(session.specializationName(null)).toBe('—');
  });

  it('returns the list for the requested role', () => {
    expect(session.staffOf('doctor').length).toBe(MOCK_DOCTORS.length);
    expect(session.staffOf('secretary').length).toBe(MOCK_SECRETARIES.length);
  });

  describe('addStaffAccount', () => {
    it('creates an active doctor and records the action', () => {
      const before = session.doctors().length;
      const created = session.addStaffAccount('doctor', {
        name: 'Ana Reyes',
        email: 'ana.reyes@mediq.ph',
        username: 'areyes',
        status: 'active',
        specializationId: 'spec-cardio',
        licenseNumber: 'PRC-999',
      });

      expect(session.doctors().length).toBe(before + 1);
      expect(created.name).toBe('Ana Reyes');
      expect(created.username).toBe('areyes');
      expect(created.status).toBe('active');
      expect(created.licenseNumber).toBe('PRC-999');
      // A brand new account has never signed in.
      expect(created.lastActiveOn).toBeNull();
      expect(session.auditEntries()[0].action).toBe('Created doctor account');
    });

    it('creates the account with the status the form asked for', () => {
      // A new hire can be created already disabled, so the status cannot be
      // hardcoded to active the way it was.
      const created = session.addStaffAccount('secretary', {
        name: 'Bea Cruz',
        email: 'bea.cruz@mediq.ph',
        username: 'bcruz',
        status: 'inactive',
      });

      expect(created.status).toBe('inactive');
    });

    it('ignores doctor-only fields for a secretary', () => {
      const created = session.addStaffAccount('secretary', {
        name: 'Bea Cruz',
        email: 'bea.cruz@mediq.ph',
        username: 'bcruz',
        status: 'active',
        specializationId: 'spec-cardio',
        licenseNumber: 'PRC-123',
        assignedDoctorId: 'doc-001',
      });

      expect(created.specializationId).toBeNull();
      expect(created.licenseNumber).toBeNull();
    });

    it('keeps the doctor a secretary is assigned to', () => {
      // The whole Secretary area is scoped by this id, so losing it would leave a
      // desk with nobody on it rather than a secretary with a doctor.
      const created = session.addStaffAccount('secretary', {
        name: 'Bea Cruz',
        email: 'bea.cruz@mediq.ph',
        username: 'bcruz',
        status: 'active',
        assignedDoctorId: 'doc-003',
      });

      expect(created.assignedDoctorId).toBe('doc-003');
    });

    it('normalises a blank assignment to no doctor', () => {
      // The form refuses to submit without one, but a whitespace-only value from
      // a caller must not persist as an id that resolves to no doctor.
      const created = session.addStaffAccount('secretary', {
        name: 'Bea Cruz',
        email: 'bea.cruz@mediq.ph',
        username: 'bcruz',
        status: 'active',
        assignedDoctorId: '   ',
      });

      expect(created.assignedDoctorId).toBeNull();
    });

    it('gives a doctor no desk, even if a draft names one', () => {
      const created = session.addStaffAccount('doctor', {
        name: 'Ana Reyes',
        email: 'ana.reyes@mediq.ph',
        username: 'areyes',
        status: 'active',
        specializationId: 'spec-cardio',
        licenseNumber: 'PRC-999',
        assignedDoctorId: 'doc-001',
      });

      expect(created.assignedDoctorId).toBeNull();
    });

    it('trims whitespace from the name', () => {
      const created = session.addStaffAccount('secretary', {
        name: '  Mae Lim  ',
        email: 'mae.lim@mediq.ph',
        username: '  mlim ',
        status: 'active',
      });
      expect(created.name).toBe('Mae Lim');
      expect(created.username).toBe('mlim');
    });

    it('gives each new account a distinct id', () => {
      const a = session.addStaffAccount('secretary', {
        name: 'One A',
        email: 'one@mediq.ph',
        username: 'onea',
        status: 'active',
      });
      const b = session.addStaffAccount('secretary', {
        name: 'Two B',
        email: 'two@mediq.ph',
        username: 'twob',
        status: 'active',
      });
      expect(a.id).not.toBe(b.id);
    });

    it('never reuses an id already present in the sample data', () => {
      // A collision would make the table's @for tracking ambiguous and render
      // the wrong row, so this guards a real failure rather than a tidy-up.
      const existing = new Set(
        [
          ...MOCK_DOCTORS,
          ...MOCK_SECRETARIES,
          ...MOCK_PATIENTS,
          ...MOCK_SPECIALIZATIONS,
          ...MOCK_AUDIT_ENTRIES,
        ].map((r) => r.id),
      );

      const added: string[] = [];
      for (let i = 0; i < 5; i++) {
        added.push(session.addSpecialization(`Spec ${i}`, 'x').id);
        added.push(
          session.addStaffAccount('secretary', {
            name: `A ${i}`,
            email: `a${i}@mediq.ph`,
            username: `a${i}`,
            status: 'active',
          }).id,
        );
      }
      expect(added.filter((id) => existing.has(id))).toEqual([]);
      expect(new Set(added).size).toBe(added.length);
    });
  });

  describe('setStaffStatus', () => {
    it('disables an active account and records a warning', () => {
      const doctor = MOCK_DOCTORS.find((d) => d.status === 'active')!;
      session.setStaffStatus('doctor', doctor.id, 'inactive');

      expect(session.doctors().find((d) => d.id === doctor.id)!.status).toBe('inactive');
      expect(session.auditEntries()[0]).toMatchObject({
        action: 'Deactivated account',
        target: doctor.name,
        severity: 'warning',
      });
    });

    it('re-enables an account as a routine entry', () => {
      const doctor = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
      session.setStaffStatus('doctor', doctor.id, 'active');

      expect(session.doctors().find((d) => d.id === doctor.id)!.status).toBe('active');
      expect(session.auditEntries()[0].severity).toBe('info');
    });

    it('does nothing when the status is unchanged', () => {
      const doctor = MOCK_DOCTORS.find((d) => d.status === 'active')!;
      const before = session.auditEntries().length;
      session.setStaffStatus('doctor', doctor.id, 'active');
      expect(session.auditEntries().length).toBe(before);
    });

    it('ignores an unknown id rather than throwing', () => {
      const before = session.doctors();
      session.setStaffStatus('doctor', 'nope', 'inactive');
      expect(session.doctors()).toEqual(before);
    });
  });

  describe('setPatientStatus', () => {
    it('deactivates a patient and records it', () => {
      const patient = MOCK_PATIENTS.find((p) => p.status === 'active')!;
      session.setPatientStatus(patient.id, 'inactive');

      expect(session.patients().find((p) => p.id === patient.id)!.status).toBe('inactive');
      expect(session.auditEntries()[0].action).toBe('Deactivated patient');
    });
  });

  describe('specializations', () => {
    it('appends a new specialization', () => {
      const before = session.specializations().length;
      const created = session.addSpecialization('  Neurology  ', '  Brain and nerves.  ');

      expect(session.specializations().length).toBe(before + 1);
      expect(created.name).toBe('Neurology');
      expect(created.description).toBe('Brain and nerves.');
    });

    it('renames in place without changing the id', () => {
      const existing = MOCK_SPECIALIZATIONS[0];
      session.updateSpecialization(existing.id, 'Cardiac Care', 'Hearts.');

      const updated = session.specializations().find((s) => s.id === existing.id)!;
      expect(updated.name).toBe('Cardiac Care');
      expect(updated.description).toBe('Hearts.');
    });

    it('leaves other specializations alone when renaming', () => {
      session.updateSpecialization(MOCK_SPECIALIZATIONS[0].id, 'Renamed', 'Changed.');
      const untouched = session.specializations().find((s) => s.id === MOCK_SPECIALIZATIONS[1].id)!;
      expect(untouched.name).toBe(MOCK_SPECIALIZATIONS[1].name);
    });

    it('ignores an unknown id', () => {
      const before = session.specializations();
      session.updateSpecialization('nope', 'X', 'Y');
      expect(session.specializations()).toEqual(before);
    });
  });

  describe('recentActivity', () => {
    it('is newest first', () => {
      session.addSpecialization('Neurology', 'Brain and nerves.');
      const times = session.recentActivity().map((entry) => entry.at);
      const sorted = [...times].sort((a, b) => b.localeCompare(a));
      expect(times).toEqual(sorted);
    });

    it('is capped so the dashboard list cannot grow without bound', () => {
      const before = MOCK_AUDIT_ENTRIES.length;
      for (let i = 0; i < 12; i++) session.addSpecialization(`Spec ${i}`, 'x');
      expect(session.auditEntries().length).toBe(before + 12);
      expect(session.recentActivity().length).toBe(6);
    });
  });

  it('treats a role and its lists independently', () => {
    const doctor = session.addStaffAccount('doctor', {
      name: 'Solo Doctor',
      email: 'solo@mediq.ph',
      username: 'solo',
      status: 'active',
    });
    const kinds: StaffKind[] = ['doctor', 'secretary'];
    expect(kinds.map((k) => session.staffOf(k).some((a) => a.id === doctor.id))).toEqual([
      true,
      false,
    ]);
  });
});
