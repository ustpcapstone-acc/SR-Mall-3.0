import { formatPHDate } from "@/lib/ph-date";
import type { ReportStatus } from "@/lib/leasing";
import { NO_METHOD, sumAmounts, totalsByMethod, type CollectionReport } from "@/lib/collections";
import { phDayStart } from "@/lib/ph-date";

/**
 * Helper to convert an image URL to a Base64 string.
 * This ensures the image is correctly embedded in the PDF even on cross-origin or complex environments.
 */
const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/jpeg");
      resolve(dataURL);
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

const LOGO_URL = "/images/srmall-logo/sr_logo2.jpg";

export const generateTenantReceiptPDF = async (
  receiptData: any,
  tenantData: any,
) => {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  try {
    const logoBase64 = await getBase64ImageFromURL(LOGO_URL);
    doc.addImage(logoBase64, "JPEG", 14, 10, 15, 15);
  } catch (e) {
    doc.setFillColor(190, 30, 45);
    doc.rect(14, 10, 15, 15, "F");
  }

  doc.setTextColor(190, 30, 45); // Crimson
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SR-MANAGE", 32, 22);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(22);
  doc.text("OFFICIAL RECEIPT", 14, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const orNumber = `OR-${receiptData.invoiceNumber ? receiptData.invoiceNumber.replace("#INV-", "").replace("#", "") : Math.floor(100000 + Math.random() * 900000)}`;
  doc.text(`Receipt No: ${orNumber}`, 14, 48);
  doc.text(`Reference No: ${receiptData.referenceNo || "SYS-PAY"}`, 14, 53);
  doc.text(`Date Issued: ${timestamp}`, 14, 58);

  doc.setLineWidth(0.5);
  doc.setDrawColor(220, 220, 220);
  doc.line(14, 63, 196, 63);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant Information", 14, 73);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Shop Name:  ${tenantData.shopName || tenantData.shop_name || "N/A"}`,
    14,
    81,
  );
  doc.text(
    `Unit Number:  ${tenantData.unitId || tenantData.unit_id || "N/A"}`,
    14,
    87,
  );
  doc.text(`Billed Month:  ${receiptData.month || "N/A"}`, 14, 93);
  doc.text(
    `Due Date:  ${receiptData.dueDate ? new Date(receiptData.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A"}`,
    14,
    99,
  );

  autoTable(doc, {
    startY: 105,
    head: [["Description", "Amount"]],
    body: [
      [
        `Payment for Invoice ${receiptData.invoiceNumber || "Manual"}`,
        `PHP ${Number(receiptData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ],
      ["", ""],
    ],
    foot: [
      [
        "TOTAL PAID",
        `PHP ${Number(receiptData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [190, 30, 45], textColor: 255, fontStyle: "bold" },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [40, 40, 40],
      fontStyle: "bold",
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a system generated receipt. Retain for your records.",
    14,
    finalY,
  );

  // Save PDF
  doc.save(`SR-Receipt-${orNumber}.pdf`);
};

export const generateTenantPDF = async (
  data: any[],
  reportTitle?: string,
  filename?: string,
) => {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF("l", "mm", "a4"); // Use Landscape for more columns
  const timestamp = new Date().toLocaleString();

  // 1. Report Header
  try {
    const logoBase64 = await getBase64ImageFromURL(LOGO_URL);
    doc.addImage(logoBase64, "JPEG", 14, 10, 15, 15);
  } catch (e) {
    doc.setFillColor(190, 30, 45);
    doc.rect(14, 10, 15, 15, "F");
  }

  doc.setTextColor(190, 30, 45); // Crimson
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SR-MANAGE", 32, 22);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(22);
  doc.text(reportTitle || "Official Tenant Summary Report", 14, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on: ${timestamp}`, 14, 48);
  doc.text(
    "Confidential Administrative Document - Tenant Intelligence Suite",
    14,
    53,
  );

  // 2. Summary Statistics
  const totalTenants = data.length;
  const totalSQM = data.reduce((sum, t) => sum + (t.sqmSize || 0), 0);
  const totalMonthlyRent = data.reduce(
    (sum, t) => sum + (t.monthlyRent || 0),
    0,
  );
  const totalBalance = data.reduce((sum, t) => sum + (t.balance || 0), 0);

  doc.setFillColor(245, 245, 245);
  doc.rect(14, 60, 270, 25, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("ACTIVE TENANTS", 20, 70);
  doc.text("OCCUPIED AREA", 70, 70);
  doc.text("MONTHLY REVENUE", 130, 70);
  doc.text("TOTAL OUTSTANDING", 200, 70);

  doc.setFontSize(14);
  doc.setTextColor(190, 30, 45);
  doc.text(totalTenants.toString(), 20, 80);
  doc.text(`${totalSQM.toFixed(1)} m²`, 70, 80);
  doc.text(`PHP ${totalMonthlyRent.toLocaleString()}`, 130, 80);
  doc.text(`PHP ${totalBalance.toLocaleString()}`, 200, 80);

  // 3. The Main Table
  const tableRows = data.map((t) => [
    t.lastReceiptNo ? `${t.shopName}\n(Rec: ${t.lastReceiptNo.replace("#INV-", "")})` : t.shopName,
    t.tenantOwner || "N/A",
    t.category || "Retail",
    t.unitId,
    `PHP ${Number(t.monthlyRent).toLocaleString()}`,
    `PHP ${Number(t.balance).toLocaleString()}`,
    t.status || "PENDING",
    t.nextDueDate
      ? new Date(t.nextDueDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A",
    t.leaseExpiryDate
      ? new Date(t.leaseExpiryDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "No lease",
  ]);

  autoTable(doc, {
    startY: 95,
    head: [
      [
        "Shop Name",
        "Owner",
        "Category",
        "Unit",
        "Monthly Rent",
        "Balance",
        "Status",
        "Due Date",
        "Lease Expiry",
      ],
    ],
    body: tableRows,
    headStyles: {
      fillColor: [190, 30, 45],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    didParseCell: (dataCell) => {
      // Expiry Date Warning
      if (dataCell.section === "body" && dataCell.column.index === 7) {
        const expiryDateStr = dataCell.cell.raw as string;
        const expiryDate = new Date(expiryDateStr);
        const today = new Date();
        const diffDays = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (diffDays <= 30 && diffDays >= 0) {
          dataCell.cell.styles.fillColor = [255, 230, 230];
          dataCell.cell.styles.textColor = [190, 30, 45];
          dataCell.cell.styles.fontStyle = "bold";
        }
      }
      // Status Coloring
      if (dataCell.section === "body" && dataCell.column.index === 5) {
        const status = dataCell.cell.raw as string;
        if (status === "OVERDUE") {
          dataCell.cell.styles.textColor = [190, 30, 45];
          dataCell.cell.styles.fontStyle = "bold";
        } else if (status === "PAID") {
          dataCell.cell.styles.textColor = [16, 185, 129];
          dataCell.cell.styles.fontStyle = "bold";
        }
      }
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      valign: "middle",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "center" },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 14, 200);
    doc.text(
      "SR-Mall Property Management - Official Intelligence Report",
      200,
      200,
    );
  }

  doc.save(
    filename ||
      `Tenant_Intelligence_Report_${new Date().toISOString().split("T")[0]}.pdf`,
  );
};

export const generateVoucherPDF = async (data: {
  shopName: string;
  category: string;
  email: string;
  tempPass: string;
  slotId: string;
  rentCost: number;
  startDate: string;
  endDate: string;
}) => {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  // Header Background
  doc.setFillColor(190, 30, 45); // #BE1E2D
  doc.rect(0, 0, 210, 50, "F");

  // Brand Logo
  try {
    const logoBase64 = await getBase64ImageFromURL(LOGO_URL);
    doc.addImage(logoBase64, "JPEG", 14, 10, 15, 15);
  } catch (e) {
    // skip add logo if fail
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("SR-MANAGE", 32, 22.5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("PROVISIONAL TENANT VOUCHER", 14, 32);
  doc.text("Mall Management System v5.0", 14, 37);

  // Badge
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.rect(150, 15, 45, 20);
  doc.text("OFFICIAL", 155, 24);
  doc.text("DOC #SR-" + Math.floor(1000 + Math.random() * 9000), 155, 29);

  // Content body
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Business Details", 14, 70);
  doc.setDrawColor(230, 230, 230);
  doc.line(14, 73, 196, 73);

  const leftCol = 14;
  const rightCol = 60;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Shop Name:", leftCol, 82);
  doc.setFont("helvetica", "bold");
  doc.text(data.shopName, rightCol, 82);

  doc.setFont("helvetica", "normal");
  doc.text("Category:", leftCol, 90);
  doc.setFont("helvetica", "bold");
  doc.text(data.category, rightCol, 90);

  doc.setFont("helvetica", "normal");
  doc.text("Assigned Unit:", leftCol, 98);
  doc.setFont("helvetica", "bold");
  doc.text(data.slotId, rightCol, 98);

  doc.setFont("helvetica", "normal");
  doc.text("Monthly Rent:", leftCol, 106);
  doc.setFont("helvetica", "bold");
  doc.text(`PHP ${data.rentCost.toLocaleString()}.00`, rightCol, 106);

  // Credentials Section
  doc.setFillColor(252, 252, 252);
  doc.rect(14, 120, 180, 50, "F");
  doc.setDrawColor(190, 30, 45);
  doc.setLineWidth(1);
  doc.rect(14, 120, 180, 50, "S");

  doc.setFillColor(190, 30, 45);
  doc.rect(14, 120, 180, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("SECURE LOGIN CREDENTIALS", 20, 126.5);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Login ID / Email:", 25, 142);
  doc.setFont("courier", "bold");
  doc.text(data.email, 65, 142);

  doc.setFont("helvetica", "normal");
  doc.text("Temporary Password:", 25, 155);
  doc.setFont("courier", "bold");
  doc.text(data.tempPass, 65, 155);

  // Security Notice
  doc.setFillColor(255, 245, 245);
  doc.rect(14, 180, 180, 20, "F");
  doc.setTextColor(190, 30, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("IMPORTANT SECURITY NOTICE:", 20, 188);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "This password is for one-time initialization. You must change it immediately upon your first login.",
    20,
    193,
  );

  // Signatures
  doc.setTextColor(40, 40, 40);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 240, 90, 240);
  doc.line(120, 240, 190, 240);

  doc.setFontSize(8);
  doc.text("Tenant Signature", 45, 245);
  doc.text("Mall Administrator", 145, 245);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const footerY = 285;
  doc.text("Generated: " + timestamp, 14, footerY);
  doc.text(
    "SR-Mall Property Management | Confidential Internal Document",
    120,
    footerY,
  );

  doc.save(`${data.shopName.replace(/\s+/g, "_")}_Credentials.pdf`);
};

export type PaymentReportRow = {
  invoiceNumber: string;
  description: string;
  unitId: string | null;
  dueDate: string | Date;
  paidOn: string | Date | null;
  method: string | null;
  referenceNo: string | null;
  amount: number;
  status: ReportStatus;
};

const PAYMENT_STATUS: Record<PaymentReportRow["status"], string> = {
  PAID: "Paid",
  DUE: "Due",
  OVERDUE: "Overdue",
  VOID: "Voided",
  CHECKING: "Being checked",
  REJECTED: "Rejected",
};

const pesos = (n: number) => `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One shop's Payment History Report: totals, then every invoice, newest due date first. */
export const generatePaymentHistoryPDF = async (
  shop: { shopName: string; units: string; ownerName?: string | null },
  rows: PaymentReportRow[],
) => {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF("l", "mm", "a4");

  try {
    const logoBase64 = await getBase64ImageFromURL(LOGO_URL);
    doc.addImage(logoBase64, "JPEG", 14, 10, 15, 15);
  } catch (e) {
    doc.setFillColor(190, 30, 45);
    doc.rect(14, 10, 15, 15, "F");
  }

  doc.setTextColor(190, 30, 45);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SR-MANAGE", 32, 20);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(18);
  doc.text("Payment History Report", 14, 37);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Shop: ${shop.shopName}`, 14, 45);
  doc.text(`Unit: ${shop.units}`, 14, 50);
  if (shop.ownerName) doc.text(`Owner: ${shop.ownerName}`, 14, 55);
  doc.text(`Generated on: ${formatPHDate(new Date())}`, 283, 45, { align: "right" });

  // Totals. Voided invoices are listed but not counted.
  const sum = (list: PaymentReportRow[]) => list.reduce((total, r) => total + r.amount, 0);
  const counted = rows.filter((r) => r.status !== "VOID");
  const paid = counted.filter((r) => r.status === "PAID");
  const unpaid = counted.filter((r) => r.status !== "PAID");
  const totals: [string, string][] = [
    ["INVOICES", `${rows.length}`],
    ["TOTAL BILLED", pesos(sum(counted))],
    [`TOTAL PAID (${paid.length})`, pesos(sum(paid))],
    [`NOT YET PAID (${unpaid.length})`, pesos(sum(unpaid))],
  ];
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 60, 269, 20, "F");
  totals.forEach(([label, value], i) => {
    const x = 20 + i * 67;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, 67);
    doc.setFontSize(13);
    doc.setTextColor(190, 30, 45);
    doc.text(value, x, 75);
  });

  const newest = [...rows].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  autoTable(doc, {
    startY: 86,
    head: [["Invoice", "Description", "Unit", "Due date", "Date paid", "Method and reference", "Status", "Amount"]],
    body: newest.map((r) => [
      r.invoiceNumber,
      r.description,
      r.unitId || "-",
      formatPHDate(r.dueDate),
      r.paidOn ? formatPHDate(r.paidOn) : "-",
      [r.method, r.referenceNo && `Ref ${r.referenceNo}`].filter(Boolean).join("\n") || "-",
      PAYMENT_STATUS[r.status],
      pesos(r.amount),
    ]),
    headStyles: { fillColor: [190, 30, 45], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
    columnStyles: { 1: { cellWidth: 60 }, 7: { halign: "right", fontStyle: "bold" } },
    didParseCell: (cell) => {
      if (cell.column.index === 7 && cell.section === "head") cell.cell.styles.halign = "right";
      if (cell.section !== "body" || cell.column.index !== 6) return;
      if (cell.cell.raw === "Paid") cell.cell.styles.textColor = [4, 120, 87];
      if (cell.cell.raw === "Overdue" || cell.cell.raw === "Rejected") cell.cell.styles.textColor = [190, 30, 45];
    },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${page} of ${pages}`, 14, 202);
    doc.text("SR Mall Property Management", 283, 202, { align: "right" });
  }

  const slug = shop.shopName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "Shop";
  doc.save(`SR-Payment-History-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
};

/** Money received on one day, with totals by method and places to sign. */
export const generateCollectionReportPDF = async (report: CollectionReport) => {
  if (typeof window === "undefined") return;

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF("l", "mm", "a4");

  try {
    const logoBase64 = await getBase64ImageFromURL(LOGO_URL);
    doc.addImage(logoBase64, "JPEG", 14, 10, 15, 15);
  } catch (e) {
    doc.setFillColor(190, 30, 45);
    doc.rect(14, 10, 15, 15, "F");
  }

  doc.setTextColor(190, 30, 45);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SR-MANAGE", 32, 20);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(18);
  doc.text("Daily Collection Report", 14, 37);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Money received on ${formatPHDate(phDayStart(report.date))}`, 14, 45);
  doc.text(`Generated on: ${formatPHDate(new Date())}`, 283, 45, { align: "right" });

  const head = { fillColor: [190, 30, 45] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const };
  autoTable(doc, {
    startY: 51,
    head: [["Method", "Payments", "Amount"]],
    body: totalsByMethod(report.rows).map((t) => [t.method, String(t.count), pesos(t.amount)]),
    foot: [["Total", String(report.rows.length), pesos(sumAmounts(report.rows))]],
    headStyles: head,
    footStyles: { fillColor: [245, 245, 245], textColor: [40, 40, 40], fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 2.5 },
    tableWidth: 140,
  });

  const after = () => (doc as any).lastAutoTable.finalY as number;
  autoTable(doc, {
    startY: after() + 8,
    head: [["Shop", "Unit", "Invoice", "For", "Method and reference", "Accepted by", "Amount"]],
    body: report.rows.length
      ? report.rows.map((r) => [
          r.shopName,
          r.unitId || "-",
          r.invoiceNumber,
          r.month,
          [r.method || NO_METHOD, r.referenceNo && `Ref ${r.referenceNo}`].filter(Boolean).join("\n"),
          r.acceptedBy || "-",
          pesos(r.amount),
        ])
      : [[{ content: "No payments were received on this day.", colSpan: 7 }]],
    headStyles: head,
    alternateRowStyles: { fillColor: [248, 248, 248] },
    styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
    columnStyles: { 6: { halign: "right", fontStyle: "bold" } },
    // A payment is never cut across two pages.
    rowPageBreak: "avoid",
  });

  if (report.voided.length) {
    autoTable(doc, {
      startY: after() + 8,
      head: [["Voided on this day (not counted)", "Invoice", "Method and reference", "Voided by", "Reason", "Amount"]],
      body: report.voided.map((v) => [
        v.shopName,
        v.invoiceNumber,
        [v.method, v.referenceNo && `Ref ${v.referenceNo}`].filter(Boolean).join("\n") || "-",
        v.actorName || "-",
        v.reason || "-",
        pesos(v.amount),
      ]),
      headStyles: { fillColor: [90, 90, 90], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
      columnStyles: { 4: { cellWidth: 70 }, 5: { halign: "right" } },
      rowPageBreak: "avoid",
    });
  }

  // Room to count the cash and sign, on a new page if this one is full.
  let y = after() + 14;
  if (y > 170) {
    doc.addPage();
    y = 24;
  }
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("Cash counted: ______________________", 14, y);
  doc.text("Difference: ______________________", 110, y);
  doc.text("Prepared by: ______________________", 14, y + 14);
  doc.text("Checked by: ______________________", 110, y + 14);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${page} of ${pages}`, 14, 202);
    doc.text("SR Mall Property Management", 283, 202, { align: "right" });
  }

  doc.save(`SR-Collections-${report.date}.pdf`);
};
