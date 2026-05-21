'use client';

import { COMPANY_CONFIG } from '../config/company';

const formatWhatsAppUrl = (message?: string) => {
  const base = `https://wa.me/${COMPANY_CONFIG.whatsapp.number}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
};

export function useCompanyContactLinks() {
  return {
    phoneHref: `tel:${COMPANY_CONFIG.phone}`,
    whatsappHref: formatWhatsAppUrl(),
    whatsappDefaultMessageHref: formatWhatsAppUrl(COMPANY_CONFIG.whatsapp.defaultMessage),
    companyQuoteWhatsappHref: formatWhatsAppUrl('I would like to get a quote for my business'),
  };
}
