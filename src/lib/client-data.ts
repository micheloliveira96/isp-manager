import { Prisma } from "@prisma/client";
import { ApiError } from "./mikrotik-http";
export async function clientFields(tx: Prisma.TransactionClient, organizationId: string, b: Record<string, unknown>) {
  const name = String(b.name || "").trim(), phone = String(b.phone || "").trim(), dueDay = Number(b.dueDay || 10);
  if(name.length < 2 || name.length > 200 || !phone || phone.length > 60) throw new ApiError(400, "Nome e telefone válidos são obrigatórios.");
  if(!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) throw new ApiError(400, "Vencimento deve ser entre os dias 1 e 28.");
  const planId = String(b.planId || "") || null;
  let price = Number(b.monthlyPrice);
  if(planId) {
    const plan = await tx.internetPlan.findFirst({where: {id: planId, organizationId, active: true}});
    if(!plan) throw new ApiError(400, "Plano inválido nesta empresa.");
    if(!Number.isFinite(price) || price <= 0) price = Number(plan.monthlyPrice);
  }
  if(!Number.isFinite(price) || price < 0 || price > 99999999) throw new ApiError(400, "Mensalidade inválida.");
  const text = (key: string, max = 500) => {const value = String(b[key] || "").trim(); if(value.length > max) throw new ApiError(400, "Campo muito longo: " + key); return value || null;};
  const installDate = b.installDate ? new Date(String(b.installDate)) : null;
  if(installDate && !Number.isFinite(installDate.getTime())) throw new ApiError(400, "Data de instalação inválida.");
  return {name, phone, dueDay, planId, monthlyPrice: price, taxNumber: text("taxNumber"), address: text("address"), postalCode: text("postalCode"), locality: text("locality"), alternatePhone: text("alternatePhone"), email: text("email"), notes: text("notes", 10000), installDate};
}
