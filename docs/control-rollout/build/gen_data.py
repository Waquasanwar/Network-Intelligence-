import csv, random, datetime as dt, json, os
random.seed(7)
OUT = "/home/user/Network-Intelligence-/docs/control-rollout"
AS_OF = dt.date(2026, 11, 5)
D = dt.date.fromisoformat

controls = [
 ("IC-01","Initial","MFA enforced for all users","Identity","High","Identity team",""),
 ("IC-02","Initial","EDR agent deployed and reporting","Endpoint","High","Endpoint team",""),
 ("IC-03","Initial","Full-disk encryption","Endpoint","High","Endpoint team","IC-09"),
 ("IC-04","Initial","OS patching within 14-day SLA","Endpoint","High","Endpoint team","IC-09"),
 ("IC-05","Initial","Local admin rights removed","Endpoint","High","Endpoint team",""),
 ("IC-06","Initial","Real-time anti-malware protection","Endpoint","Medium","Endpoint team",""),
 ("IC-07","Initial","Host firewall enabled","Network","Medium","Network team",""),
 ("IC-08","Initial","Secure baseline configuration (CIS L1)","Endpoint","Medium","Endpoint team","IC-09"),
 ("IC-09","Initial","Device enrolled in MDM","Endpoint","High","Endpoint team",""),
 ("IC-10","Initial","Legacy authentication blocked","Identity","High","Identity team","IC-01"),
 ("IC-11","Initial","Security logs forwarded to SIEM","Monitoring","High","SecOps",""),
 ("IC-12","Initial","Browser hardening policy","Endpoint","Medium","Endpoint team","IC-09"),
 ("IC-13","Initial","Removable media control","Data","Medium","Endpoint team",""),
 ("IC-14","Initial","Screen lock and session timeout","Endpoint","Low","Endpoint team","IC-09"),
 ("IC-15","Initial","Email attachment sandboxing","Email","Medium","SecOps",""),
 ("IC-16","Initial","Backup agent installed","Resilience","Medium","Infrastructure",""),
 ("IC-17","Initial","Asset inventory registration","Governance","Medium","Infrastructure",""),
 ("IC-18","Initial","Password policy and self-service reset","Identity","Low","Identity team",""),
 ("MC-01","Medium","Conditional access on device compliance","Identity","High","Identity team","IC-01;IC-09"),
 ("MC-02","Medium","Application allow-listing (audit mode)","Endpoint","Medium","Endpoint team","IC-02"),
 ("MC-03","Medium","Attack surface reduction rules","Endpoint","High","Endpoint team","IC-02"),
 ("MC-04","Medium","Privileged access workstations for admins","Identity","High","Identity team","IC-05"),
 ("MC-05","Medium","Third-party application patching","Endpoint","High","Endpoint team","IC-04"),
 ("MC-06","Medium","Protective DNS filtering","Network","Medium","Network team",""),
 ("MC-07","Medium","Data loss prevention (monitor)","Data","Medium","SecOps","IC-09"),
 ("MC-08","Medium","Vulnerability scanning agent","Monitoring","High","SecOps","IC-17"),
 ("MC-09","Medium","Macro and script execution controls","Endpoint","High","Endpoint team","IC-08"),
 ("MC-10","Medium","Network access control (802.1X)","Network","Medium","Network team","IC-17"),
 ("FC-01","Full","Application allow-listing (enforce)","Endpoint","High","Endpoint team","MC-02"),
 ("FC-02","Full","Just-in-time privileged access (PAM)","Identity","High","Identity team","MC-04"),
 ("FC-03","Full","Network micro-segmentation","Network","High","Network team","MC-10"),
 ("FC-04","Full","Data loss prevention (block)","Data","Medium","SecOps","MC-07"),
 ("FC-05","Full","Immutable backups with restore testing","Resilience","High","Infrastructure","IC-16"),
 ("FC-06","Full","Automated 24x7 containment (SOAR)","Monitoring","High","SecOps","IC-11;IC-02"),
]
fw = {"Identity":"NIST CSF PR.AA / CIS 5-6","Endpoint":"NIST CSF PR.PS / CIS 2,4,10","Network":"NIST CSF PR.IR / CIS 12-13",
      "Monitoring":"NIST CSF DE.CM / CIS 8,13","Data":"NIST CSF PR.DS / CIS 3","Email":"NIST CSF PR.PS / CIS 9",
      "Resilience":"NIST CSF RC.RP / CIS 11","Governance":"NIST CSF ID.AM / CIS 1"}
rings = [
 ("Ring 1","Pilot: IT and security team",150,"2026-07-31","2026-09-30","2026-11-30","Head of IT"),
 ("Ring 2","Wider IT and digital champions",600,"2026-09-15","2026-11-15","2027-01-31","Head of IT"),
 ("Ring 3","Head office and corporate functions",2500,"2026-10-31","2027-01-15","2027-03-15","COO"),
 ("Ring 4","Regional offices and field staff",4000,"2026-12-15","2027-02-28","2027-04-30","Regional Ops Director"),
 ("Ring 5","Critical operations and remaining estate",2750,"2027-02-15","2027-04-15","2027-06-30","Operations Director"),
]
tidx = {"Initial":3,"Medium":4,"Full":5}
# status plans per ring/tier, in planned-date order (earliest first)
def plan(**k):
    out=[]
    for s,n in k.items(): out += [s.replace("_"," ")]*n
    return out
P = {
 ("Ring 1","Initial"): plan(Implemented=17, Exception=1),
 ("Ring 1","Medium"):  plan(Implemented=8, Pending_evidence=1, In_progress=1),
 ("Ring 1","Full"):    plan(Implemented=2, In_progress=2, Planned=2),
 ("Ring 2","Initial"): plan(Implemented=15, Blocked=1, In_progress=2),
 ("Ring 2","Medium"):  plan(Implemented=4, In_progress=3, Planned=3),
 ("Ring 2","Full"):    plan(Not_started=6),
 ("Ring 3","Initial"): plan(Implemented=9, Pending_evidence=3, In_progress=4, Blocked=1, Exception=1),
 ("Ring 3","Medium"):  plan(Planned=6, Not_started=4),
 ("Ring 3","Full"):    plan(Not_started=6),
 ("Ring 4","Initial"): plan(Implemented=2, In_progress=3, Planned=13),
 ("Ring 4","Medium"):  plan(Not_started=10),
 ("Ring 4","Full"):    plan(Not_started=6),
 ("Ring 5","Initial"): plan(Planned=4, Not_started=14),
 ("Ring 5","Medium"):  plan(Not_started=9, **{"N/A":1}),
 ("Ring 5","Full"):    plan(Not_started=6),
}
comments = {
 "Blocked": ["Waiting on vendor fix for legacy app compatibility","Change freeze during finance year-end","Hardware does not support TPM 2.0"],
 "Exception": ["Risk accepted: legacy lab devices, compensating control in place (expires 2027-03-31)",
               "Risk accepted: kiosk devices, network isolated (expires 2027-01-31)"],
 "In progress": ["Rolling out in batches","Pilot group complete, wider push under way","Remediating failed devices"],
 "Pending evidence": ["Deployed; awaiting compliance report from MDM"],
 "N/A": ["Control not applicable to OT devices in this ring"],
}
rows=[]
ci = {c[0]:c for c in controls}
for r in rings:
    for tier in ("Initial","Medium","Full"):
        tcs=[c for c in controls if c[1]==tier]; n=len(tcs)
        target=D(r[tidx[tier]])
        span = 56 if tier=="Initial" else 42
        statuses = P[(r[0],tier)]
        for i,c in enumerate(tcs):
            planned = target - dt.timedelta(days=round(span*(n-1-i)/(n-1)))
            st = statuses[i]
            actual=""
            pct=0
            if st in ("Implemented","Pending evidence"):
                a = planned + dt.timedelta(days=random.randint(-10,18))
                if a > AS_OF: a = AS_OF - dt.timedelta(days=random.randint(1,12))
                actual=a.isoformat(); pct = 100 if st=="Implemented" else random.choice([97,98,100])
            elif st=="In progress": pct=random.choice([35,45,60,70,80,85])
            elif st=="Blocked": pct=random.choice([10,20,30])
            elif st=="Exception": pct=random.choice([88,92,94])
            cm = random.choice(comments.get(st,[""]))
            exc = f"RA-{2026}-{random.randint(10,99)}" if st=="Exception" else ""
            rows.append(dict(key=f"{c[0]} · {r[0]}", control_id=c[0], tier=tier, control_name=c[2], domain=c[3],
                             risk_if_absent=c[4], owner=c[5], ring=r[0], population=r[2],
                             planned_date=planned.isoformat(), actual_date=actual, status=st, pct_deployed=pct,
                             exception_ref=exc, comment=cm, as_of=AS_OF.isoformat()))
json.dump(dict(controls=controls, rings=rings, rows=rows, fw=fw, as_of=AS_OF.isoformat()),
          open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"data.json"),"w"), indent=1)
with open(OUT+"/deployments.csv","w",newline="") as f:
    w=csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
with open(OUT+"/rings.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["ring","scope","population","initial_target","medium_target","full_target","business_owner"]); w.writerows(rings)
from collections import Counter
print(len(rows), Counter(r["status"] for r in rows))
