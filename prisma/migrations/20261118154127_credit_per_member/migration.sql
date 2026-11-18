-- A placement can owe more than one member: whoever shared the work and whoever referred the person.
DROP INDEX "ReferralCredit_briefId_placedId_key";
CREATE UNIQUE INDEX "ReferralCredit_briefId_placedId_personId_key" ON "ReferralCredit"("briefId", "placedId", "personId");
