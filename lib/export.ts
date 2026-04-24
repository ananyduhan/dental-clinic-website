import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { AppointmentWithRelations, AppointmentExportRow } from "@/types";

export function buildAppointmentWorkbook(appointments: AppointmentWithRelations[]): XLSX.WorkBook {
  const rows: AppointmentExportRow[] = appointments.map((appt) => ({
    "Patient Name": `${appt.patient.firstName} ${appt.patient.lastName}`,
    "Patient Phone": appt.patient.phone ?? "",
    Dentist: `Dr. ${appt.dentist.user.firstName} ${appt.dentist.user.lastName}`,
    Service: appt.service.name,
    Date: format(new Date(appt.appointmentDate), "dd/MM/yyyy"),
    Time: appt.startTime,
    Status: appt.status,
    Notes: appt.notes ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  // Auto-size columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key as keyof AppointmentExportRow]).length)),
  }));
  worksheet["!cols"] = colWidths;

  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
