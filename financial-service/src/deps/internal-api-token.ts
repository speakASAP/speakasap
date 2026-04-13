export function getOutboundInternalToken(): string {
  return (
    process.env.INTERNAL_API_TOKEN ||
    process.env.PAYMENT_SERVICE_INTERNAL_TOKEN ||
    process.env.SALARY_SERVICE_INTERNAL_TOKEN ||
    process.env.COURSE_SERVICE_INTERNAL_TOKEN ||
    ''
  );
}
