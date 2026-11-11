import bcrypt from 'bcryptjs';
import { pool, checkConnection, initDatabase } from '../db.ts';

interface SeedSummary {
  table: string;
  count: number;
}

export async function runSeed(): Promise<SeedSummary[]> {
  console.log('===============================================================');
  console.log('🌱 Starting Healthcare RCM PostgreSQL Database Seeding');
  console.log('===============================================================');

  const connStatus = await checkConnection();
  if (!connStatus.connected) {
    throw new Error(`Cannot connect to PostgreSQL database '${connStatus.database}': ${connStatus.error}`);
  }

  // Ensure tables exist before populating
  await initDatabase();

  const client = await pool.connect();
  const summary: SeedSummary[] = [];

  try {
    await client.query('BEGIN;');

    console.log('🧹 Clearing existing demo data cleanly with CASCADE...');
    await client.query(`
      TRUNCATE TABLE
        payment_predictions,
        denials,
        payments,
        claims,
        medical_coding,
        charges,
        prior_authorizations,
        insurance,
        registrations,
        appointments,
        doctors,
        patients,
        departments,
        users
      CASCADE;
    `);

    // =========================================================================
    // 1. DEPARTMENTS (8 Departments)
    // =========================================================================
    console.log('🏢 Seeding 17 Clinical Departments...');
    const departments = [
      { id: 'dept-cardio', name: 'Cardiology', icon: 'heart', color: '#EF4444', description: 'Comprehensive heart, cardiovascular & hemodynamic diagnostics and care' },
      { id: 'dept-ortho', name: 'Orthopedics', icon: 'bone', color: '#06B6D4', description: 'Advanced musculoskeletal, joint, spine, and sports medicine rehabilitation' },
      { id: 'dept-derm', name: 'Dermatology', icon: 'sparkles', color: '#EC4899', description: 'Clinical & surgical dermatology, skin lesion biopsy, and phototherapy' },
      { id: 'dept-neuro', name: 'Neurology', icon: 'brain', color: '#8B5CF6', description: 'Central nervous system disorders, stroke management, and EEG diagnostics' },
      { id: 'dept-ped', name: 'Pediatrics', icon: 'baby', color: '#F59E0B', description: 'Comprehensive neonatal, child, and adolescent healthcare & immunizations' },
      { id: 'dept-gen', name: 'General Medicine', icon: 'stethoscope', color: '#10B981', description: 'Primary care, chronic disease management, and internal medicine' },
      { id: 'dept-onc', name: 'Oncology', icon: 'activity', color: '#D97706', description: 'Medical oncology, chemotherapy administration, and tumor surveillance' },
      { id: 'dept-ent', name: 'ENT & Otolaryngology', icon: 'mic', color: '#3B82F6', description: 'Ear, nose, throat diagnostics, audiology, and endoscopic sinus treatments' },
      { id: 'dept-pulmo', name: 'Pulmonology & Respiratory', icon: 'wind', color: '#0284C7', description: 'Comprehensive respiratory diagnostics, asthma, COPD & critical pulmonary care' },
      { id: 'dept-gastro', name: 'Gastroenterology & Hepatology', icon: 'shield', color: '#14B8A6', description: 'Advanced endoscopic procedures, liver disease, and digestive tract disorders' },
      { id: 'dept-nephro', name: 'Nephrology & Renal Care', icon: 'activity', color: '#6366F1', description: 'Kidney health, dialysis management, hypertension, and fluid balance therapies' },
      { id: 'dept-emergency', name: 'Emergency & Trauma Care', icon: 'alert-triangle', color: '#DC2626', description: '24/7 urgent resuscitation, acute trauma stabilization, and emergency triage' },
      { id: 'dept-ophthal', name: 'Ophthalmology & Eye Surgery', icon: 'eye', color: '#0D9488', description: 'Vision diagnostics, cataract surgery, retinal therapy, and pediatric optometry' },
      { id: 'dept-psych', name: 'Psychiatry & Behavioral Health', icon: 'smile', color: '#7C3AED', description: 'Mental health assessment, counseling, cognitive behavioral therapy, and psychotherapy' },
      { id: 'dept-uro', name: 'Urology & Urological Care', icon: 'stethoscope', color: '#2563EB', description: 'Urinary system treatment, minimally invasive urology, and kidney stone management' },
      { id: 'dept-radiology', name: 'Diagnostic Radiology & Imaging', icon: 'camera', color: '#475569', description: 'Advanced MRI, CT scanning, ultrasound, mammography, and interventional radiology' },
      { id: 'dept-endocrinology-diabetes', name: 'Endocrinology & Diabetes', icon: 'activity', color: '#8B5CF6', description: 'Hormonal, metabolic, thyroid and diabetic clinical treatments' },
    ];

    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (id, name, icon, color, description, status)
         VALUES ($1, $2, $3, $4, $5, 'Active')`,
        [d.id, d.name, d.icon, d.color, d.description]
      );
    }
    summary.push({ table: 'departments', count: departments.length });

    // =========================================================================
    // 2. DOCTORS (15 Doctors)
    // =========================================================================
    console.log('👨‍⚕️ Seeding 15 Medical Providers & Doctors...');
    const doctorsData = [
      { id: 'doc-001', name: 'Dr. Arvind Swaminathan', deptId: 'dept-cardio', spec: 'Interventional Cardiology', room: 'Suite 401', exp: '16 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-002', name: 'Dr. Rajesh Sharma', deptId: 'dept-ortho', spec: 'Joint Replacement & Spine Surgery', room: 'Suite 205', exp: '14 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-003', name: 'Dr. Meenakshi Sundaram', deptId: 'dept-derm', spec: 'Clinical Dermatology & Biopsy', room: 'Suite 108', exp: '11 Years', hours: { start: '09:30 AM', end: '05:30 PM' } },
      { id: 'doc-004', name: 'Dr. Ananya Sen', deptId: 'dept-neuro', spec: 'Cognitive Neurology & Epilepsy', room: 'Suite 310', exp: '13 Years', hours: { start: '08:00 AM', end: '03:30 PM' } },
      { id: 'doc-005', name: 'Dr. Vikram Malhotra', deptId: 'dept-gen', spec: 'Internal Medicine & Preventive Care', room: 'Suite 102', exp: '18 Years', hours: { start: '08:00 AM', end: '04:00 PM' } },
      { id: 'doc-006', name: 'Dr. Preeti Deshmukh', deptId: 'dept-ped', spec: 'Pediatric Pulmonology', room: 'Suite 114', exp: '9 Years', hours: { start: '10:00 AM', end: '06:00 PM' } },
      { id: 'doc-007', name: 'Dr. Suresh Pillai', deptId: 'dept-onc', spec: 'Hematology & Medical Oncology', room: 'Suite 502', exp: '20 Years', hours: { start: '09:00 AM', end: '04:00 PM' } },
      { id: 'doc-008', name: 'Dr. Kavita Nair', deptId: 'dept-ent', spec: 'Endoscopic Sinus & Otology', room: 'Suite 218', exp: '12 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-009', name: 'Dr. Rohan Gupta', deptId: 'dept-cardio', spec: 'Electrophysiology & Heart Failure', room: 'Suite 404', exp: '10 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-010', name: 'Dr. Sunita Joshi', deptId: 'dept-ortho', spec: 'Sports Medicine & Arthroscopy', room: 'Suite 209', exp: '15 Years', hours: { start: '08:00 AM', end: '04:00 PM' } },
      { id: 'doc-011', name: 'Dr. David Wilson', deptId: 'dept-gen', spec: 'Geriatric & Family Medicine', room: 'Suite 105', exp: '22 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-012', name: 'Dr. Sarah Jenkins', deptId: 'dept-neuro', spec: 'Neurovascular & Stroke Care', room: 'Suite 312', exp: '14 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-013', name: 'Dr. Deepak Patel', deptId: 'dept-onc', spec: 'Surgical Oncology Consultation', room: 'Suite 506', exp: '17 Years', hours: { start: '09:30 AM', end: '05:00 PM' } },
      { id: 'doc-014', name: 'Dr. Shalini Verma', deptId: 'dept-ped', spec: 'General Pediatrics & Neonatology', room: 'Suite 116', exp: '8 Years', hours: { start: '10:00 AM', end: '06:00 PM' } },
      { id: 'doc-015', name: 'Dr. Amit Singhal', deptId: 'dept-ent', spec: 'Head & Neck Surgical Consultation', room: 'Suite 220', exp: '13 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-016', name: 'Dr. Rajeshwar Chawla', deptId: 'dept-pulmo', spec: 'Interventional Pulmonology & Asthma', room: 'Suite 304', exp: '15 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-017', name: 'Dr. Nandini Iyer', deptId: 'dept-gastro', spec: 'Advanced Endoscopy & Liver Care', room: 'Suite 212', exp: '13 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-018', name: 'Dr. Arun Balasubramanian', deptId: 'dept-nephro', spec: 'Renal Dialysis & Hypertension', room: 'Suite 408', exp: '17 Years', hours: { start: '09:00 AM', end: '04:00 PM' } },
      { id: 'doc-019', name: 'Dr. Kabir Mukherjee', deptId: 'dept-emergency', spec: 'Emergency Resuscitation & Acute Care', room: 'ER Bay 1', exp: '11 Years', hours: { start: '07:00 AM', end: '07:00 PM' } },
      { id: 'doc-020', name: 'Dr. Vandana Rao', deptId: 'dept-ophthal', spec: 'Cataract & Refractive Eye Surgery', room: 'Suite 118', exp: '14 Years', hours: { start: '09:30 AM', end: '05:30 PM' } },
      { id: 'doc-021', name: 'Dr. Sameer Kulkarni', deptId: 'dept-psych', spec: 'Cognitive Behavioral Therapy & Neuropsychiatry', room: 'Suite 510', exp: '12 Years', hours: { start: '10:00 AM', end: '06:00 PM' } },
      { id: 'doc-022', name: 'Dr. Tarun Sengupta', deptId: 'dept-uro', spec: 'Endourology & Laser Stone Surgery', room: 'Suite 224', exp: '16 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-023', name: 'Dr. Radhika Bansal', deptId: 'dept-radiology', spec: 'Neuroradiology & Cross-Sectional MRI/CT', room: 'Imaging Suite B', exp: '10 Years', hours: { start: '08:00 AM', end: '04:00 PM' } },
      { id: 'doc-024', name: 'Dr. Alok Mathur', deptId: 'dept-endocrinology-diabetes', spec: 'Diabetes & Thyroid Disorder Management', room: 'Suite 302', exp: '15 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-025', name: 'Dr. Priya Ramanathan', deptId: 'dept-cardio', spec: 'Non-Invasive Cardiology & Echocardiography', room: 'Suite 406', exp: '11 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-026', name: 'Dr. Karthik Subramanian', deptId: 'dept-ortho', spec: 'Pediatric Orthopedics & Trauma Reconstruction', room: 'Suite 207', exp: '12 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-027', name: 'Dr. Fatima Zahra', deptId: 'dept-derm', spec: 'Cosmetic Dermatology & Advanced Laser Therapies', room: 'Suite 110', exp: '9 Years', hours: { start: '10:00 AM', end: '06:00 PM' } },
      { id: 'doc-028', name: 'Dr. Siddharth Verma', deptId: 'dept-pulmo', spec: 'Sleep Medicine, Bronchoscopy & Critical Care', room: 'Suite 306', exp: '14 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-029', name: 'Dr. Ritu Choudhury', deptId: 'dept-gastro', spec: 'Inflammatory Bowel Disease & Hepatology', room: 'Suite 214', exp: '16 Years', hours: { start: '08:00 AM', end: '04:00 PM' } },
      { id: 'doc-030', name: 'Dr. Manisha Singhania', deptId: 'dept-nephro', spec: 'Kidney Transplantation & Glomerular Diseases', room: 'Suite 410', exp: '13 Years', hours: { start: '09:30 AM', end: '05:30 PM' } },
      { id: 'doc-031', name: 'Dr. Neil Joseph', deptId: 'dept-emergency', spec: 'Trauma Resuscitation & Emergency Critical Care', room: 'ER Bay 2', exp: '18 Years', hours: { start: '07:00 PM', end: '07:00 AM' } },
      { id: 'doc-032', name: 'Dr. Anjali Deshpande', deptId: 'dept-ophthal', spec: 'Glaucoma & Vitreoretinal Microsurgery', room: 'Suite 120', exp: '15 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
      { id: 'doc-033', name: 'Dr. Nikhil Chidambaram', deptId: 'dept-psych', spec: 'Addiction Psychiatry & Mood Disorder Therapy', room: 'Suite 512', exp: '11 Years', hours: { start: '10:30 AM', end: '06:30 PM' } },
      { id: 'doc-034', name: 'Dr. Devendra Bhatt', deptId: 'dept-uro', spec: 'Urologic Oncology & Robotic Kidney Surgery', room: 'Suite 226', exp: '19 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-035', name: 'Dr. Swati Agarwal', deptId: 'dept-radiology', spec: 'Musculoskeletal MRI & Interventional Radiology', room: 'Imaging Suite C', exp: '12 Years', hours: { start: '08:30 AM', end: '04:30 PM' } },
      { id: 'doc-036', name: 'Dr. Harish Nambiar', deptId: 'dept-endocrinology-diabetes', spec: 'Pediatric Endocrinology & Pituitary Disorders', room: 'Suite 308', exp: '14 Years', hours: { start: '09:00 AM', end: '05:00 PM' } },
    ];

    for (const doc of doctorsData) {
      const deptObj = departments.find(d => d.id === doc.deptId);
      await client.query(
        `INSERT INTO doctors (id, name, department_id, department_name, avatar, specialization, working_hours, room_number, experience)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          doc.id,
          doc.name,
          doc.deptId,
          deptObj ? deptObj.name : 'General Medicine',
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(doc.name)}`,
          doc.spec,
          JSON.stringify(doc.hours),
          doc.room,
          doc.exp
        ]
      );
    }
    summary.push({ table: 'doctors', count: doctorsData.length });

    // =========================================================================
    // 3. PATIENTS (50 Patients)
    // =========================================================================
    console.log('🧑‍🤝‍🧑 Seeding 50 Synthetic Patients...');
    const patientNames = [
      { first: 'Rahul', last: 'Kumar', gender: 'Male', dob: '1984-04-12', blood: 'O+' },
      { first: 'Arun', last: 'Raj', gender: 'Male', dob: '1979-09-23', blood: 'B+' },
      { first: 'Priya', last: 'Sharma', gender: 'Female', dob: '1992-11-05', blood: 'A+' },
      { first: 'Meena', last: 'Krishnan', gender: 'Female', dob: '1968-02-17', blood: 'AB+' },
      { first: 'David', last: 'Wilson', gender: 'Male', dob: '1955-07-30', blood: 'O-' },
      { first: 'Anita', last: 'Desai', gender: 'Female', dob: '1988-06-19', blood: 'B-' },
      { first: 'Karthik', last: 'Iyer', gender: 'Male', dob: '1995-01-28', blood: 'A+' },
      { first: 'Pooja', last: 'Nair', gender: 'Female', dob: '1990-08-14', blood: 'O+' },
      { first: 'Sanjay', last: 'Patel', gender: 'Male', dob: '1972-12-03', blood: 'B+' },
      { first: 'Deepa', last: 'Menon', gender: 'Female', dob: '1981-05-22', blood: 'A-' },
      { first: 'Amit', last: 'Bose', gender: 'Male', dob: '1963-03-10', blood: 'O+' },
      { first: 'Sneha', last: 'Kulkarni', gender: 'Female', dob: '1997-10-09', blood: 'AB-' },
      { first: 'Manoj', last: 'Tiwari', gender: 'Male', dob: '1976-08-25', blood: 'B+' },
      { first: 'Lakshmi', last: 'Narayanan', gender: 'Female', dob: '1958-04-16', blood: 'O+' },
      { first: 'Rohit', last: 'Verma', gender: 'Male', dob: '1989-07-07', blood: 'A+' },
      { first: 'Divya', last: 'Rao', gender: 'Female', dob: '1994-12-30', blood: 'B+' },
      { first: 'Suresh', last: 'Chandran', gender: 'Male', dob: '1965-09-18', blood: 'O-' },
      { first: 'Kavita', last: 'Reddy', gender: 'Female', dob: '1983-01-11', blood: 'A+' },
      { first: 'Rajesh', last: 'Koothrappali', gender: 'Male', dob: '1986-10-06', blood: 'AB+' },
      { first: 'Sunita', last: 'Pillai', gender: 'Female', dob: '1971-06-27', blood: 'O+' },
      { first: 'Vijay', last: 'Anand', gender: 'Male', dob: '1991-03-15', blood: 'B+' },
      { first: 'Swati', last: 'Mukherjee', gender: 'Female', dob: '1987-11-20', blood: 'A-' },
      { first: 'Prakash', last: 'Joshi', gender: 'Male', dob: '1960-05-04', blood: 'O+' },
      { first: 'Geeta', last: 'Raman', gender: 'Female', dob: '1978-08-31', blood: 'B-' },
      { first: 'Alok', last: 'Nath', gender: 'Male', dob: '1952-02-14', blood: 'A+' },
      { first: 'Ritu', last: 'Aggarwal', gender: 'Female', dob: '1993-07-22', blood: 'O+' },
      { first: 'Sandeep', last: 'Hegde', gender: 'Male', dob: '1980-09-08', blood: 'AB+' },
      { first: 'Malini', last: 'Mohan', gender: 'Female', dob: '1985-04-03', blood: 'B+' },
      { first: 'Harish', last: 'Bhatt', gender: 'Male', dob: '1974-12-19', blood: 'A+' },
      { first: 'Neha', last: 'Kapoor', gender: 'Female', dob: '1996-06-11', blood: 'O+' },
      { first: 'Naveen', last: 'Siddharth', gender: 'Male', dob: '1988-01-25', blood: 'B+' },
      { first: 'Archana', last: 'Chopra', gender: 'Female', dob: '1970-10-17', blood: 'A+' },
      { first: 'Ramesh', last: 'Babu', gender: 'Male', dob: '1962-03-29', blood: 'O-' },
      { first: 'Shilpa', last: 'Shetty', gender: 'Female', dob: '1984-08-08', blood: 'AB-' },
      { first: 'Gaurav', last: 'Pandey', gender: 'Male', dob: '1990-05-13', blood: 'B+' },
      { first: 'Bhavna', last: 'Vyas', gender: 'Female', dob: '1979-11-28', blood: 'A+' },
      { first: 'Chethan', last: 'Kumar', gender: 'Male', dob: '1993-02-09', blood: 'O+' },
      { first: 'Madhavi', last: 'Latha', gender: 'Female', dob: '1966-07-04', blood: 'B+' },
      { first: 'Ashok', last: 'Gajapathi', gender: 'Male', dob: '1957-12-21', blood: 'A-' },
      { first: 'Nandini', last: 'Sen', gender: 'Female', dob: '1991-09-14', blood: 'O+' },
      { first: 'Tushar', last: 'Mahajan', gender: 'Male', dob: '1982-04-18', blood: 'B+' },
      { first: 'Pallavi', last: 'Shinde', gender: 'Female', dob: '1986-06-02', blood: 'AB+' },
      { first: 'Girish', last: 'Karnad', gender: 'Male', dob: '1969-01-30', blood: 'O+' },
      { first: 'Usha', last: 'Uthup', gender: 'Female', dob: '1959-10-24', blood: 'A+' },
      { first: 'Dinesh', last: 'Karthik', gender: 'Male', dob: '1985-06-01', blood: 'B-' },
      { first: 'Anjali', last: 'Tendulkar', gender: 'Female', dob: '1973-11-10', blood: 'O+' },
      { first: 'Varun', last: 'Dhawan', gender: 'Male', dob: '1989-04-24', blood: 'A+' },
      { first: 'Radha', last: 'Mitchell', gender: 'Female', dob: '1977-08-16', blood: 'B+' },
      { first: 'Kiran', last: 'Bedi', gender: 'Other', dob: '1964-06-09', blood: 'O+' },
      { first: 'Siddharth', last: 'Roy', gender: 'Male', dob: '1998-03-21', blood: 'AB+' },
    ];

    const patients: any[] = [];
    for (let i = 0; i < patientNames.length; i++) {
      const p = patientNames[i];
      const id = `pat-${String(i + 1).padStart(3, '0')}`;
      const patientId = `PAT-${1000 + i + 1}`;
      const phone = `+1 (555) ${String(200 + i).padStart(3, '0')}-${String(1000 + i * 17).slice(0, 4)}`;
      const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}@example.com`;
      const address = `${100 + i * 12} Healthcare Blvd, Suite ${10 + (i % 20)}, Metro City, CA 90210`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.first + p.last)}`;
      const emContact = `${p.first} Kin: +1 (555) 900-${String(1000 + i * 11).slice(0, 4)}`;

      await client.query(
        `INSERT INTO patients (id, patient_id, first_name, last_name, dob, gender, phone, email, address, avatar, blood_group, emergency_contact)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, patientId, p.first, p.last, p.dob, p.gender, phone, email, address, avatar, p.blood, emContact]
      );
      patients.push({ id, patientId, ...p, phone, email, address, avatar, emContact });
    }
    summary.push({ table: 'patients', count: patients.length });

    // =========================================================================
    // 4. REGISTRATIONS (50 Registrations - Exactly 1 per Patient)
    // =========================================================================
    console.log('📝 Seeding 50 Patient Registrations (1:1 with Patients)...');
    const idTypes = ['National ID', 'Driver License', 'Passport', 'State ID'];
    const relationships = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend'];

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i];
      const regId = `reg-${String(i + 1).padStart(3, '0')}`;
      const idType = idTypes[i % idTypes.length];
      const idNum = `ID-${idType.slice(0, 2).toUpperCase()}-${String(880000 + i * 143)}`;
      const rel = relationships[i % relationships.length];
      const status = i < 40 ? 'Registered' : i < 47 ? 'Verified' : 'Pending';
      const regDate = `2026-0${1 + (i % 8)}-${String(10 + (i % 18)).padStart(2, '0')}`;

      await client.query(
        `INSERT INTO registrations (
          id, patient_id, appointment_id, id_type, id_number, emergency_contact_name,
          emergency_contact_relationship, emergency_contact_phone, registration_date, registration_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          regId,
          p.id,
          null, // linked later if needed
          idType,
          idNum,
          `${p.last} Emergency Contact`,
          rel,
          `+1 (555) 888-${String(1000 + i * 19).slice(0, 4)}`,
          regDate,
          status,
          `Identity verified via ${idType}. Consent and HIPAA forms signed electronically.`
        ]
      );
    }
    summary.push({ table: 'registrations', count: patients.length });

    // =========================================================================
    // 5. INSURANCE (50 Insurance Records - 1 per Patient)
    // =========================================================================
    console.log('🛡️ Seeding 50 Insurance Eligibility Records...');
    const payers = [
      { name: 'Blue Cross Blue Shield', group: 'GRP-BCBS-8821', copay: 25, ded: 1000, coin: 15 },
      { name: 'UnitedHealthcare', group: 'GRP-UHC-4402', copay: 35, ded: 1500, coin: 20 },
      { name: 'Aetna Health', group: 'GRP-AET-9011', copay: 30, ded: 1200, coin: 15 },
      { name: 'Cigna Global Health', group: 'GRP-CIG-3319', copay: 40, ded: 2000, coin: 20 },
      { name: 'Medicare Part B / Advantage', group: 'GRP-MED-1004', copay: 20, ded: 500, coin: 10 },
      { name: 'Humana Healthcare', group: 'GRP-HUM-6623', copay: 30, ded: 1500, coin: 15 },
      { name: 'Kaiser Permanente', group: 'GRP-KP-7711', copay: 25, ded: 750, coin: 10 },
    ];

    const insuranceList: any[] = [];
    for (let i = 0; i < patients.length; i++) {
      const p = patients[i];
      const payer = payers[i % payers.length];
      const insId = `ins-${String(i + 1).padStart(3, '0')}`;
      const memberId = `MEM-${payer.name.slice(0, 3).toUpperCase()}-${String(450000 + i * 291)}`;
      const policyNumber = `POL-${String(9000000 + i * 431)}`;
      const status = i < 42 ? 'Active' : i < 47 ? 'Pending Verification' : 'Expired';
      const eligibility = status === 'Active' ? 'Eligible' : status === 'Pending Verification' ? 'Pending' : 'Not Eligible';

      const coveredServices = [
        'Outpatient Consultation',
        'Diagnostic Imaging',
        'Laboratory Services',
        'Emergency Treatment',
        'Preventive Health Screenings'
      ];

      const verResult = {
        isVerified: status === 'Active',
        verifiedAt: new Date(Date.now() - (i * 86400000)).toISOString(),
        message: status === 'Active' ? 'Coverage active and 100% verified via EDI 270/271' : 'Eligibility pending insurer confirmation',
        providerStatus: status === 'Active' ? 'Accepted' : 'Pending'
      };

      await client.query(
        `INSERT INTO insurance (
          id, patient_id, insurance_provider, member_id, policy_number,
          policy_holder_name, relationship_to_patient, group_number, effective_date,
          expiry_date, insurance_status, eligibility_status, coverage_status,
          copay_amount, deductible, coinsurance, covered_services, verification_result,
          provider_status, treatment_amount, requested_amount, patient_responsibility_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          insId,
          p.id,
          payer.name,
          memberId,
          policyNumber,
          `${p.first} ${p.last}`,
          'Self',
          payer.group,
          '2026-01-01',
          '2026-12-31',
          status,
          eligibility,
          status === 'Active' ? 'Comprehensive Commercial In-Network' : 'Under Review',
          payer.copay,
          payer.ded,
          payer.coin,
          JSON.stringify(coveredServices),
          JSON.stringify(verResult),
          verResult.providerStatus,
          1250.00,
          1050.00,
          200.00
        ]
      );
      insuranceList.push({ id: insId, patientId: p.id, payer: payer.name, memberId, policyNumber, copay: payer.copay, coin: payer.coin });
    }
    summary.push({ table: 'insurance', count: patients.length });

    // =========================================================================
    // 6. APPOINTMENTS (75 Appointments)
    // =========================================================================
    console.log('📅 Seeding 75 Interconnected Appointments...');
    const appointmentTypes = ['Consultation', 'Follow-up', 'Routine Checkup', 'Specialist Consultation', 'Emergency'];
    const times = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:15 PM', '04:00 PM'];

    const appointments: any[] = [];
    for (let i = 0; i < 75; i++) {
      const aptId = `apt-${String(i + 1).padStart(3, '0')}`;
      const code = `APT${10001 + i}`;
      const patient = patients[i % patients.length];
      const doctor = doctorsData[i % doctorsData.length];
      const dept = departments.find(d => d.id === doctor.deptId) || departments[0];

      // Distribution: 45 Completed, 15 Confirmed, 8 Scheduled, 4 Cancelled, 3 No-show
      const status = i < 45 ? 'Completed' : i < 60 ? 'Confirmed' : i < 68 ? 'Scheduled' : i < 72 ? 'Cancelled' : 'No-show';
      const aptType = appointmentTypes[i % appointmentTypes.length];
      const dayOffset = (i < 45 ? -(45 - i) : (i - 45)) * 2;
      const aptDateObj = new Date(Date.now() + (dayOffset * 86400000));
      const aptDate = aptDateObj.toISOString().split('T')[0];
      const aptTime = times[i % times.length];

      await client.query(
        `INSERT INTO appointments (
          id, appointment_code, patient_id, doctor_id, department_id, department_name,
          appointment_date, appointment_time, duration_minutes, appointment_type, status,
          reason_for_visit, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          aptId,
          code,
          patient.id,
          doctor.id,
          dept.id,
          dept.name,
          aptDate,
          aptTime,
          30,
          aptType,
          status,
          `Clinical evaluation for ${dept.name.toLowerCase()} presenting symptoms.`,
          `Patient intake registered. Vitals recorded by triage nurse.`
        ]
      );
      appointments.push({ id: aptId, code, patientId: patient.id, doctorId: doctor.id, deptId: dept.id, deptName: dept.name, date: aptDate, status });
    }
    summary.push({ table: 'appointments', count: appointments.length });

    // =========================================================================
    // 7. PRIOR AUTHORIZATIONS (30 Records)
    // =========================================================================
    console.log('📑 Seeding 30 Prior Authorization Records...');
    const paServices = [
      { name: 'MRI Brain with and without contrast', cpt: '70553', icd: 'R51.0', cost: 1850 },
      { name: 'Knee Diagnostic & Surgical Arthroscopy', cpt: '29881', icd: 'M17.11', cost: 3200 },
      { name: 'Coronary Computed Tomography Angiography', cpt: '75574', icd: 'I25.10', cost: 2400 },
      { name: 'Spine Lumbar MRI without contrast', cpt: '72148', icd: 'M54.5', cost: 1450 },
      { name: 'Endoscopic Sinus Surgery with Biopsy', cpt: '31237', icd: 'J32.9', cost: 2800 },
      { name: 'Echocardiography with Doppler Complete', cpt: '93306', icd: 'I50.9', cost: 950 },
    ];

    const priorAuths: any[] = [];
    for (let i = 0; i < 30; i++) {
      const paId = `pa-${String(i + 1).padStart(3, '0')}`;
      const reqId = `PA-REQ-${20000 + i}`;
      const patient = patients[i % patients.length];
      const apt = appointments[i % appointments.length];
      const doc = doctorsData[i % doctorsData.length];
      const ins = insuranceList.find(item => item.patientId === patient.id) || insuranceList[0];
      const serv = paServices[i % paServices.length];
      
      // Status: 20 Approved, 6 Pending, 3 Denied, 1 Draft
      const status = i < 20 ? 'Approved' : i < 26 ? 'Pending' : i < 29 ? 'Denied' : 'Draft';
      const authNum = status === 'Approved' ? `AUTH-BCBS-${77000 + i}` : null;
      const validFrom = status === 'Approved' ? '2026-02-01' : null;
      const validUntil = status === 'Approved' ? '2026-08-01' : null;

      await client.query(
        `INSERT INTO prior_authorizations (
          id, authorization_request_id, patient_id, appointment_id, service_name,
          procedure_code, diagnosis_code, doctor_id, doctor_name, department_id, department_name,
          insurance_provider, member_id, policy_number, request_date, service_date,
          estimated_cost, medical_justification, supporting_documents, authorization_required,
          status, authorization_number, approved_date, valid_from, valid_until, denial_reason, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )`,
        [
          paId,
          reqId,
          patient.id,
          apt.id,
          serv.name,
          serv.cpt,
          serv.icd,
          doc.id,
          doc.name,
          doc.deptId,
          apt.deptName,
          ins.payer,
          ins.memberId,
          ins.policyNumber,
          '2026-02-10',
          '2026-02-25',
          serv.cost,
          `Conservative medical management failed. Diagnostic intervention medically necessary per NCCN / AHA guidelines.`,
          JSON.stringify(['Physician_Clinical_Notes.pdf', 'Radiology_Initial_Xray.pdf']),
          true,
          status,
          authNum,
          status === 'Approved' ? '2026-02-14' : null,
          validFrom,
          validUntil,
          status === 'Denied' ? 'Criteria for medical necessity not met under current commercial policy guidelines.' : null,
          'Processed through Electronic Prior Authorization (ePA) Portal.'
        ]
      );
      priorAuths.push({ id: paId, reqId, patientId: patient.id, service: serv.name, cpt: serv.cpt, icd: serv.icd, status, cost: serv.cost });
    }
    summary.push({ table: 'prior_authorizations', count: priorAuths.length });

    // =========================================================================
    // 8. CHARGES (100 Charge Encounters with items and financial logic)
    // =========================================================================
    console.log('💳 Seeding 100 Charge Capture Encounters with Realistic Financials...');
    const clinicalProcedures = [
      { code: '99213', desc: 'Office outpatient visit established, low complexity', rate: 140, cat: 'Consultation' },
      { code: '99214', desc: 'Office outpatient visit established, moderate complexity', rate: 220, cat: 'Consultation' },
      { code: '99215', desc: 'Office outpatient visit established, high complexity', rate: 320, cat: 'Consultation' },
      { code: '93000', desc: 'Electrocardiogram routine ECG with interpretation', rate: 180, cat: 'Diagnostic Test' },
      { code: '80053', desc: 'Comprehensive metabolic panel blood test', rate: 120, cat: 'Laboratory Test' },
      { code: '85025', desc: 'Complete blood count CBC with automated differential', rate: 85, cat: 'Laboratory Test' },
      { code: '71046', desc: 'Radiologic examination chest 2 views', rate: 210, cat: 'Diagnostic Test' },
      { code: '70553', desc: 'MRI brain with and without contrast material', rate: 1650, cat: 'Procedure / Surgery' },
      { code: '29881', desc: 'Arthroscopy knee surgical with meniscectomy', rate: 3200, cat: 'Procedure / Surgery' },
      { code: '99283', desc: 'Emergency department visit moderate severity', rate: 580, cat: 'Consultation' },
      { code: '36415', desc: 'Routine venipuncture for blood specimen collection', rate: 35, cat: 'Laboratory Test' },
      { code: '90834', desc: 'Psychotherapy 45 minutes with patient', rate: 190, cat: 'Therapy & Rehabilitation' },
    ];

    const diagnosisList = [
      { code: 'I10', desc: 'Essential (primary) hypertension' },
      { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
      { code: 'M54.5', desc: 'Low back pain unspecified' },
      { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified' },
      { code: 'R07.9', desc: 'Chest pain, unspecified' },
      { code: 'K21.9', desc: 'Gastro-esophageal reflux disease without esophagitis' },
      { code: 'M17.11', desc: 'Unilateral primary osteoarthritis, right knee' },
      { code: 'R51.0', desc: 'Headache with orthostatic component' },
      { code: 'Z00.00', desc: 'Encounter for general adult medical examination' },
      { code: 'I25.10', desc: 'Atherosclerotic heart disease of native coronary artery' },
    ];

    const chargeEncounters: any[] = [];
    for (let i = 0; i < 100; i++) {
      const chargeId = `enc-${String(i + 1).padStart(3, '0')}`;
      const patient = patients[i % patients.length];
      const apt = appointments[i % appointments.length];
      const doc = doctorsData[i % doctorsData.length];
      const ins = insuranceList.find(item => item.patientId === patient.id) || insuranceList[0];
      const proc1 = clinicalProcedures[i % clinicalProcedures.length];
      const proc2 = clinicalProcedures[(i + 3) % clinicalProcedures.length];
      const diag = diagnosisList[i % diagnosisList.length];

      const item1Total = proc1.rate;
      const item2Total = (i % 3 === 0) ? proc2.rate : 0;
      const totalCharge = item1Total + item2Total;

      // Realistic reimbursement: Insurance covers ~75-80%
      const expectedIns = Math.round(totalCharge * 0.78 * 100) / 100;
      const patientResp = Math.round((totalCharge - expectedIns) * 100) / 100;

      // Status distributions
      // 0-55 Paid in Full, 56-75 Partial Payment, 76-90 Billed, 91-99 Draft/Ready
      let claimStatus = 'Paid in Full';
      let insReceived = expectedIns;
      let insPending = 0;
      let patPaid = patientResp;
      let patPending = 0;

      if (i >= 55 && i < 75) {
        claimStatus = 'Partial Paid';
        insReceived = Math.round(expectedIns * 0.70 * 100) / 100;
        insPending = Math.round((expectedIns - insReceived) * 100) / 100;
        patPaid = ins.copay;
        patPending = Math.round((patientResp - patPaid) * 100) / 100;
      } else if (i >= 75 && i < 90) {
        claimStatus = 'Billed';
        insReceived = 0;
        insPending = expectedIns;
        patPaid = 0;
        patPending = patientResp;
      } else if (i >= 90) {
        claimStatus = 'Ready to Bill';
        insReceived = 0;
        insPending = expectedIns;
        patPaid = 0;
        patPending = patientResp;
      }

      const totalAR = Math.round((totalCharge - insReceived - patPaid) * 100) / 100;

      const items = [
        {
          id: `item-${chargeId}-1`,
          serviceDescription: proc1.desc,
          category: proc1.cat,
          procedureCode: proc1.code,
          diagnosisCode: diag.code,
          quantity: 1,
          unitRate: proc1.rate,
          totalCharge: item1Total,
          insuranceExpected: Math.round(item1Total * 0.78 * 100) / 100,
          patientExpected: Math.round(item1Total * 0.22 * 100) / 100,
          insurancePaid: (insReceived > 0) ? Math.round(item1Total * 0.78 * (insReceived / expectedIns) * 100) / 100 : 0,
          patientPaid: (patPaid > 0) ? Math.round(item1Total * 0.22 * (patPaid / (patientResp || 1)) * 100) / 100 : 0,
          pendingAmount: Math.round((item1Total - ((insReceived > 0 ? item1Total * 0.78 : 0) + (patPaid > 0 ? item1Total * 0.22 : 0))) * 100) / 100,
          codingStatus: 'Coded',
          billingStatus: claimStatus === 'Paid in Full' ? 'Paid in Full' : 'Pending'
        }
      ];

      if (item2Total > 0) {
        items.push({
          id: `item-${chargeId}-2`,
          serviceDescription: proc2.desc,
          category: proc2.cat,
          procedureCode: proc2.code,
          diagnosisCode: diag.code,
          quantity: 1,
          unitRate: proc2.rate,
          totalCharge: item2Total,
          insuranceExpected: Math.round(item2Total * 0.78 * 100) / 100,
          patientExpected: Math.round(item2Total * 0.22 * 100) / 100,
          insurancePaid: (insReceived > 0) ? Math.round(item2Total * 0.78 * (insReceived / expectedIns) * 100) / 100 : 0,
          patientPaid: (patPaid > 0) ? Math.round(item2Total * 0.22 * (patPaid / (patientResp || 1)) * 100) / 100 : 0,
          pendingAmount: Math.round((item2Total - ((insReceived > 0 ? item2Total * 0.78 : 0) + (patPaid > 0 ? item2Total * 0.22 : 0))) * 100) / 100,
          codingStatus: 'Coded',
          billingStatus: claimStatus === 'Paid in Full' ? 'Paid in Full' : 'Pending'
        });
      }

      const encPayments = [];
      if (insReceived > 0) {
        encPayments.push({
          id: `pay-${chargeId}-ins`,
          source: 'Insurance',
          paymentType: 'Electronic Remittance Advice (835)',
          amount: insReceived,
          paymentDate: '2026-03-01',
          status: 'Completed',
          referenceNumber: `ERA-${ins.memberId.slice(-5)}-${900 + i}`,
          notes: 'Auto-posted remittance from commercial payer'
        });
      }
      if (patPaid > 0) {
        encPayments.push({
          id: `pay-${chargeId}-pat`,
          source: 'Patient',
          paymentType: 'Credit Card / Copay',
          amount: patPaid,
          paymentDate: '2026-02-28',
          status: 'Completed',
          referenceNumber: `CC-TRANS-${5000 + i}`,
          notes: 'Point of service copay collected at reception'
        });
      }

      await client.query(
        `INSERT INTO charges (
          id, patient_id, appointment_id, encounter_date, visit_type,
          doctor_id, doctor_name, department_id, department_name,
          insurance_provider, member_id, policy_number, insurance_verification_status,
          claim_status, items, payments, total_charges, expected_insurance_coverage,
          insurance_received, insurance_pending, patient_responsibility, patient_paid,
          patient_pending, total_outstanding_ar, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        )`,
        [
          chargeId,
          patient.id,
          apt.id,
          apt.date,
          'Outpatient Clinical Encounter',
          doc.id,
          doc.name,
          doc.deptId,
          apt.deptName,
          ins.payer,
          ins.memberId,
          ins.policyNumber,
          'Verified',
          claimStatus,
          JSON.stringify(items),
          JSON.stringify(encPayments),
          totalCharge,
          expectedIns,
          insReceived,
          insPending,
          patientResp,
          patPaid,
          patPending,
          totalAR,
          `Encounter verified. Coding and financial audit performed.`
        ]
      );

      chargeEncounters.push({
        id: chargeId,
        patientId: patient.id,
        patientName: `${patient.first} ${patient.last}`,
        patientAge: 2026 - parseInt(patient.dob.split('-')[0], 10),
        gender: patient.gender,
        appointmentId: apt.id,
        doctorId: doc.id,
        doctorName: doc.name,
        deptName: apt.deptName,
        insPayer: ins.payer,
        totalCharge,
        expectedIns,
        insReceived,
        patientResp,
        patPaid,
        totalAR,
        primaryCpt: proc1.code,
        primaryCptDesc: proc1.desc,
        primaryIcd: diag.code,
        primaryIcdDesc: diag.desc,
        claimStatus,
        date: apt.date,
        items
      });
    }
    summary.push({ table: 'charges', count: chargeEncounters.length });

    // =========================================================================
    // 9. MEDICAL CODING (100 Records matching encounters)
    // =========================================================================
    console.log('🩺 Seeding 100 Medical Coding Records...');
    for (let i = 0; i < chargeEncounters.length; i++) {
      const enc = chargeEncounters[i];
      const codingId = `cod-${String(i + 1).padStart(3, '0')}`;

      const diagnoses = [
        { id: `diag-${i}-1`, type: 'Primary', code: enc.primaryIcd, description: enc.primaryIcdDesc, status: 'Validated', isPrimary: true },
        { id: `diag-${i}-2`, type: 'Secondary', code: 'Z00.00', description: 'Encounter for general medical examination', status: 'Validated', isPrimary: false }
      ];

      const procedures = enc.items.map((it: any, pIdx: number) => ({
        id: `proc-${i}-${pIdx}`,
        serviceDescription: it.serviceDescription,
        cptCode: it.procedureCode,
        units: it.quantity,
        chargeAmount: it.totalCharge,
        codingStatus: 'Completed'
      }));

      const valMessages = [
        { id: `val-${i}-1`, level: 'Complete', title: 'CCI Edits Passed', message: 'No unbundled procedure code collisions detected.' },
        { id: `val-${i}-2`, level: 'Complete', title: 'Medical Necessity Confirmed', message: 'Diagnosis code supports documented procedure code per CMS LCD.' }
      ];

      await client.query(
        `INSERT INTO medical_coding (
          id, encounter_id, patient_id, appointment_id, encounter_date,
          doctor_id, doctor_name, department_id, department_name,
          services, diagnoses, procedures, coding_status, validation_messages, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )`,
        [
          codingId,
          enc.id,
          enc.patientId,
          enc.appointmentId,
          enc.date,
          enc.doctorId,
          enc.doctorName,
          departments.find(d => d.name === enc.deptName)?.id || 'dept-gen',
          enc.deptName,
          JSON.stringify(enc.items),
          JSON.stringify(diagnoses),
          JSON.stringify(procedures),
          'READY FOR CLAIM CREATION',
          JSON.stringify(valMessages),
          'Reviewed and validated by certified medical coder (CPC). Compliant with ICD-10-CM guidelines.'
        ]
      );
    }
    summary.push({ table: 'medical_coding', count: chargeEncounters.length });

    // =========================================================================
    // 10. CLAIMS (100 Claims directly corresponding to encounters)
    // =========================================================================
    console.log('📑 Seeding 100 Claims with Realistic Risk and Payment Indicators...');
    const claims: any[] = [];

    for (let i = 0; i < chargeEncounters.length; i++) {
      const enc = chargeEncounters[i];
      const claimId = `CLM-${String(100000 + i + 1)}`;

      // Realistic statuses:
      // i < 55: Approved / Paid
      // 55 <= i < 75: Processing / Partially Paid
      // 75 <= i < 88: Submitted / Unpaid
      // 88 <= i < 100: Denied / Unpaid
      let claimStatus = 'Approved';
      let finalPayment = 'Paid';
      let predictedStatus = 'Paid';
      let prob = 0.88 + ((i % 10) * 0.01);
      let riskLevel = 'Low Risk';

      if (i >= 55 && i < 75) {
        claimStatus = 'Partially Paid';
        finalPayment = 'Paid';
        predictedStatus = 'Paid';
        prob = 0.72 + ((i % 8) * 0.01);
        riskLevel = 'Medium Risk';
      } else if (i >= 75 && i < 88) {
        claimStatus = 'Submitted';
        finalPayment = 'Unpaid';
        predictedStatus = (i % 2 === 0) ? 'Paid' : 'Unpaid';
        prob = 0.55 + ((i % 6) * 0.03);
        riskLevel = 'Medium Risk';
      } else if (i >= 88) {
        claimStatus = 'Denied';
        finalPayment = 'Unpaid';
        predictedStatus = 'Unpaid';
        prob = 0.22 + ((i % 5) * 0.03);
        riskLevel = 'High Risk';
      }

      const prevClaims = 1 + (i % 7);
      const prevPaid = finalPayment === 'Paid' ? prevClaims : Math.max(0, prevClaims - 2);
      const prevUnpaid = prevClaims - prevPaid;
      const prevDenials = (riskLevel === 'High Risk') ? 2 : (riskLevel === 'Medium Risk') ? 1 : 0;
      const daysSince = 5 + (i % 45);

      await client.query(
        `INSERT INTO claims (
          claim_id, patient_id, patient_name, patient_age, gender, department, doctor,
          insurance_provider, claim_amount, procedure_code, procedure_description,
          diagnosis_code, diagnosis_description, number_of_procedures, previous_claims_count,
          previous_paid_claims, previous_unpaid_claims, previous_denials, outstanding_amount,
          days_since_claim_submission, claim_type, final_payment_status, predicted_status,
          payment_probability, risk_level, claim_status, submission_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
        )`,
        [
          claimId,
          enc.patientId,
          enc.patientName,
          enc.patientAge,
          enc.gender,
          enc.deptName,
          enc.doctorName,
          enc.insPayer,
          enc.totalCharge,
          enc.primaryCpt,
          enc.primaryCptDesc,
          enc.primaryIcd,
          enc.primaryIcdDesc,
          enc.items.length,
          prevClaims,
          prevPaid,
          prevUnpaid,
          prevDenials,
          enc.totalAR,
          daysSince,
          'Outpatient',
          finalPayment,
          predictedStatus,
          prob,
          riskLevel,
          claimStatus,
          new Date(Date.now() - (daysSince * 86400000)).toISOString()
        ]
      );

      claims.push({
        claimId,
        encounterId: enc.id,
        patientId: enc.patientId,
        totalCharge: enc.totalCharge,
        insPayer: enc.insPayer,
        claimStatus,
        finalPayment,
        predictedStatus,
        prob,
        riskLevel,
        insReceived: enc.insReceived,
        patPaid: enc.patPaid,
        totalAR: enc.totalAR
      });
    }
    summary.push({ table: 'claims', count: claims.length });

    // =========================================================================
    // 11. PAYMENTS (100 Real Payment Transactions)
    // =========================================================================
    console.log('💵 Seeding 100 Payment Transactions...');
    for (let i = 0; i < claims.length; i++) {
      const cl = claims[i];
      const payId = `pay-${String(i + 1).padStart(3, '0')}`;
      
      const isInsurancePayer = (i % 3 !== 0);
      const payer = isInsurancePayer ? cl.insPayer : 'Patient Direct Payment';
      const source = isInsurancePayer ? 'Insurance' : 'Patient';
      const payType = isInsurancePayer ? 'Electronic Funds Transfer (EFT)' : 'Credit Card / Online Portal';
      const payAmt = isInsurancePayer ? (cl.insReceived > 0 ? cl.insReceived : Math.round(cl.totalCharge * 0.78 * 100) / 100) : (cl.patPaid > 0 ? cl.patPaid : 25.00);
      const status = cl.finalPayment === 'Paid' ? 'Completed' : (i % 2 === 0 ? 'Pending' : 'Partial Paid');
      const refNum = isInsurancePayer ? `EFT-835-${String(700000 + i * 111)}` : `CC-AUTH-${String(300000 + i * 222)}`;

      await client.query(
        `INSERT INTO payments (
          id, encounter_id, claim_id, patient_id, source, payment_type, payer,
          amount, payment_date, status, reference_number, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )`,
        [
          payId,
          cl.encounterId,
          cl.claimId,
          cl.patientId,
          source,
          payType,
          payer,
          payAmt,
          '2026-03-02',
          status,
          refNum,
          `Remittance posted against claim ${cl.claimId}. Reconciled with bank deposit.`
        ]
      );
    }
    summary.push({ table: 'payments', count: claims.length });

    // =========================================================================
    // 12. DENIALS (20 Denials for Denied or High/Medium Risk Claims)
    // =========================================================================
    console.log('🚫 Seeding 20 Claim Denial & Appeal Records...');
    const denialReasons = [
      { code: 'CO-16', reason: 'Claim lacks information or has non-covered procedure billing item', amtMult: 1.0 },
      { code: 'CO-18', reason: 'Exact duplicate claim/service previously submitted', amtMult: 0.8 },
      { code: 'CO-27', reason: 'Expenses incurred after coverage terminated by subscriber policy', amtMult: 1.0 },
      { code: 'CO-50', reason: 'Non-covered service: Medical necessity not documented per CMS guidelines', amtMult: 0.9 },
      { code: 'PR-204', reason: 'This service is not covered until prior authorization is obtained', amtMult: 1.0 },
      { code: 'CO-97', reason: 'Benefit included in payment/allowance for primary service', amtMult: 0.5 },
    ];

    const deniedClaims = claims.filter(c => c.claimStatus === 'Denied' || c.riskLevel === 'High Risk').slice(0, 20);
    // If not enough, fill with claims from the end
    while (deniedClaims.length < 20) {
      deniedClaims.push(claims[100 - deniedClaims.length - 1]);
    }

    for (let i = 0; i < deniedClaims.length; i++) {
      const dc = deniedClaims[i];
      const denId = `den-${String(i + 1).padStart(3, '0')}`;
      const reasonObj = denialReasons[i % denialReasons.length];
      const denAmt = Math.round(dc.totalCharge * reasonObj.amtMult * 100) / 100;
      
      const denStatus = i < 12 ? 'Active' : i < 17 ? 'Resolved' : 'Closed';
      const appealStatus = i < 8 ? 'Under Review' : i < 14 ? 'Appeal Submitted' : i < 18 ? 'Overturned' : 'Upheld';

      await client.query(
        `INSERT INTO denials (
          id, claim_id, patient_id, denial_code, denial_reason, denial_amount,
          denial_status, appeal_status, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )`,
        [
          denId,
          dc.claimId,
          dc.patientId,
          reasonObj.code,
          reasonObj.reason,
          denAmt,
          denStatus,
          appealStatus,
          `Payer CARC reason: ${reasonObj.code}. Clinical appeal letter and supporting chart notes generated by RCM team.`
        ]
      );
    }
    summary.push({ table: 'denials', count: deniedClaims.length });

    // =========================================================================
    // 13. PAYMENT PREDICTIONS (100 Records - 1:1 with Claims)
    // =========================================================================
    console.log('🤖 Seeding 100 Machine Learning Payment Prediction Records...');
    for (let i = 0; i < claims.length; i++) {
      const cl = claims[i];
      const predId = `pred-${String(i + 1).padStart(3, '0')}`;

      const totalVotes = 28;
      const votesPaid = Math.round(cl.prob * totalVotes);
      const votesUnpaid = totalVotes - votesPaid;

      const topFactors = [
        {
          factor: 'Prior Payer Approval Ratio',
          impact: cl.prob >= 0.7 ? 'positive' : 'negative',
          weight: 0.35,
          description: `${cl.insPayer} historical clean claim clearance rate is ${Math.round(cl.prob * 100)}%`
        },
        {
          factor: 'Patient Eligibility Status',
          impact: 'positive',
          weight: 0.25,
          description: 'Commercial policy in-network verification confirmed active'
        },
        {
          factor: 'Clinical Coding Complexity',
          impact: cl.riskLevel === 'High Risk' ? 'negative' : 'positive',
          weight: 0.20,
          description: `Medical code validation verified with ${cl.riskLevel.toLowerCase()} audit profile`
        },
        {
          factor: 'Prior Authorization Check',
          impact: cl.riskLevel === 'High Risk' ? 'negative' : 'neutral',
          weight: 0.20,
          description: 'Authorization guidelines cross-referenced against payer rules'
        }
      ];

      const inputFeatures = {
        claimAmount: cl.totalCharge,
        payer: cl.insPayer,
        riskLevel: cl.riskLevel,
        probability: cl.prob,
        predictedStatus: cl.predictedStatus
      };

      await client.query(
        `INSERT INTO payment_predictions (
          id, claim_id, prediction, probability, risk_level, votes_paid, votes_unpaid,
          votes_total, top_factors, input_features
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )`,
        [
          predId,
          cl.claimId,
          cl.predictedStatus,
          cl.prob,
          cl.riskLevel,
          votesPaid,
          votesUnpaid,
          totalVotes,
          JSON.stringify(topFactors),
          JSON.stringify(inputFeatures)
        ]
      );
    }
    summary.push({ table: 'payment_predictions', count: claims.length });

    // =========================================================================
    // 14. USERS (System Staff Accounts)
    // =========================================================================
    console.log('👤 Seeding System Users & Roles...');
    const users = [
      { id: 'usr-admin-1', name: 'System Administrator', email: 'admin@medicare.com', role: 'Admin' },
      { id: 'usr-biller-1', name: 'Rahul Biller', email: 'billing@medicare.com', role: 'User' },
      { id: 'usr-coder-1', name: 'Priya Coder', email: 'coder@medicare.com', role: 'User' },
    ];

    const passwordHash = bcrypt.hashSync('admin123', 10);
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`,
        [u.id, u.name, u.email, passwordHash, u.role]
      );
    }
    summary.push({ table: 'users', count: users.length });

    await client.query('COMMIT;');

    console.log('===============================================================');
    console.log('🎉 [Success] Database Seeding Completed Successfully!');
    console.log('===============================================================');
    for (const s of summary) {
      console.log(`  ✓ Table '${s.table}': ${s.count} records inserted`);
    }
    return summary;
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ [Error] Database Seeding Failed and was Rolled Back:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run directly if invoked via node CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
