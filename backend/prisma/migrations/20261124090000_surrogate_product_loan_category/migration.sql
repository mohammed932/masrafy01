-- v36.5.0 — a surrogate product's own LOAN TYPE: what it is for. A label, not a restriction.
ALTER TABLE "platform_enumeration" ADD COLUMN "productLoanCategory" "LoanCategory";

-- Every existing product takes the loan type the names selling it are most often sold under
-- WITHOUT a payslip (the Program catalog's own grouping); a tie goes to the enum's order.
-- A product nothing sells yet stays NULL, and the screens read its questions instead.
UPDATE "platform_enumeration" p
   SET "productLoanCategory" = pick.category
  FROM (
    SELECT DISTINCT ON (n."surrogateProductKey")
           n."surrogateProductKey" AS product_key,
           lc.category
      FROM "platform_enumeration" n
      JOIN "platform_enumeration_loan_category" lc ON lc."enumerationId" = n.id
     WHERE n.type = 'program_name'
       AND n."surrogateProductKey" IS NOT NULL
       AND lc."noPayslip" = true
     GROUP BY n."surrogateProductKey", lc.category
     ORDER BY n."surrogateProductKey", count(*) DESC, lc.category
  ) pick
 WHERE p.type = 'surrogate_product'
   AND p.key = pick.product_key;
