import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule, ColorScaleRule
from openpyxl.utils import get_column_letter as L
OUT="/home/user/Network-Intelligence-/docs/control-rollout/Control_Rollout_Tracker.xlsx"
T={"Initial":["Block USB on managed laptops","Block copy of files/data from managed app to unmanaged app or device","Disable screen recording/screenshots",
"Block file transfers from mobile device via removable media","Remove unsanctioned client apps on device","Manage Chalhoub-owned laptops/Macs by corporate tech team",
"Prevent admin privileges on managed devices","Block personal data with >1000 records","Block uploads to personal email (Netskope, browser)",
"Block uploads to personal cloud drives","Block attachments to personal/free email domains","Block copy/paste to unsanctioned (AI) apps",
"Block external sharing via O365 sharing links","Restrict printing to approved printers","Enforce collection of managed devices at end of employment",
"Block Top 10 risky cloud apps / allow sanctioned apps only","Access reviews on GitLab and reduce authorisation level","DLP security awareness training"],
"Medium":["Disable unused/risky OS features (OS hardening)","Disable printing completely from servers (GPO)","Block uploads to personal email (Outlook)",
"Block obfuscated files shared externally","Automated classification over email, desktop and O365","Apply blocks based on file classification label scenarios",
"Block default access to file servers, on-prem and cloud (GPO)","Control AI capabilities (Intune)","Block access to corporate apps from unmanaged devices",
"Block Top 20 risky cloud apps / allow sanctioned apps only"],
"Full":["Block unmanaged devices connecting to network","Restrict server internet access","Enforce non-web traffic via always-on corporate proxy, VPN or SSE",
"Restrict DNS and ICMP traffic","Access reviews by data and system owners","Secure disposal and destruction"]}
NAME={"Initial":"Initial controls","Medium":"Medium coverage","Full":"Full coverage"}
PFX={"Initial":"IC","Medium":"MC","Full":"FC"}
# placeholder target dates: ring n, tier offsets (months)
def mend(y,m):
    y+= (m-1)//12; m=(m-1)%12+1
    return (dt.date(y+(m==12),m%12+1,1)-dt.timedelta(days=1))
TARGET={(r,t):mend(2026,11+r+o) for r in range(5) for o,t in enumerate(["Initial","Medium","Full"])}
STAT=["Not started","In progress","Applied","N/A"]
NAVY="1F2A44"; HF=Font(bold=True,color="FFFFFF"); HFILL=PatternFill("solid",fgColor=NAVY)
thin=Side(style="thin",color="D5DBE3"); BOX=Border(left=thin,right=thin,top=thin,bottom=thin)
fill=lambda c:PatternFill("solid",fgColor=c,bgColor=c)
G,A,R,GR,BL="1B7F3B","F2B53A","D64545","E3E7EC","F5F6F8"

wb=Workbook()
# ---------------- Tracker ----------------
tr=wb.active; tr.title="Tracker"
tr["A1"]="Control rollout tracker"; tr["A1"].font=Font(bold=True,size=16,color=NAVY)
tr["A2"]="Set a target date and status for each control in each ring. Red = target date passed and not applied."; tr["A2"].font=Font(italic=True,color="5A6578")
tr["A4"]="ID"; tr["B4"]="Tier"; tr["C4"]="Control"
for c in ("A4","B4","C4"): tr[c].font=HF; tr[c].fill=HFILL; tr.merge_cells(f"{c}:{c[0]}5")
for r in range(5):
    c0=4+r*2
    tr.merge_cells(start_row=4,start_column=c0,end_row=4,end_column=c0+1)
    x=tr.cell(row=4,column=c0,value=f"Ring {r+1}"); x.font=HF; x.fill=HFILL; x.alignment=Alignment(horizontal="center")
    for k,h in enumerate(["Target","Status"]):
        y=tr.cell(row=5,column=c0+k,value=h); y.font=Font(bold=True,color=NAVY); y.fill=PatternFill("solid",fgColor="DCE3EC"); y.alignment=Alignment(horizontal="center")
    tr.column_dimensions[L(c0)].width=11; tr.column_dimensions[L(c0+1)].width=13
tr.cell(row=4,column=14,value="Rings applied").font=HF; tr.cell(row=4,column=14).fill=HFILL; tr.merge_cells("N4:N5")
tr.column_dimensions["A"].width=7; tr.column_dimensions["B"].width=9; tr.column_dimensions["C"].width=58; tr.column_dimensions["N"].width=13
row=6
for t,items in T.items():
    for j in range(1,15): tr.cell(row=row,column=j).fill=PatternFill("solid",fgColor="2F6F8F")
    x=tr.cell(row=row,column=1,value=f"{NAME[t]} ({len(items)})"); x.font=HF
    row+=1
    for i,name in enumerate(items,1):
        tr.cell(row=row,column=1,value=f"{PFX[t]}-{i:02d}"); tr.cell(row=row,column=2,value=t); tr.cell(row=row,column=3,value=name)
        for r in range(5):
            c0=4+r*2
            d=tr.cell(row=row,column=c0,value=TARGET[(r,t)]); d.number_format="dd-mmm-yy"; d.alignment=Alignment(horizontal="center"); d.border=BOX
            s=tr.cell(row=row,column=c0+1,value="Not started"); s.alignment=Alignment(horizontal="center"); s.border=BOX
        sc=[f"{L(5+r*2)}{row}" for r in range(5)]
        tr.cell(row=row,column=14,value="="+"+".join(f'({c}="Applied")' for c in sc)+'&" / 5"').alignment=Alignment(horizontal="center")
        row+=1
LAST=row-1
tr.freeze_panes="D6"
dv=DataValidation(type="list",formula1='"'+",".join(STAT)+'"',allow_blank=True); tr.add_data_validation(dv)
for r in range(5):
    sc=L(5+r*2); dc=L(4+r*2); rng=f"{sc}6:{sc}{LAST}"; dv.add(rng)
    f=f"{sc}6"
    tr.conditional_formatting.add(rng,FormulaRule(formula=[f'{f}="Applied"'],fill=fill(G),font=Font(color="FFFFFF",bold=True),stopIfTrue=True))
    tr.conditional_formatting.add(rng,FormulaRule(formula=[f'{f}="N/A"'],fill=fill(BL),font=Font(color="9AA3AF"),stopIfTrue=True))
    tr.conditional_formatting.add(rng,FormulaRule(formula=[f'AND($B6<>"",{dc}6<>"",{dc}6<Dashboard!$C$3)'],fill=fill(R),font=Font(color="FFFFFF",bold=True),stopIfTrue=True))
    tr.conditional_formatting.add(rng,FormulaRule(formula=[f'{f}="In progress"'],fill=fill(A),stopIfTrue=True))
    tr.conditional_formatting.add(rng,FormulaRule(formula=[f'{f}="Not started"'],fill=fill(GR),font=Font(color="5A6578"),stopIfTrue=True))
    drng=f"{dc}6:{dc}{LAST}"
    tr.conditional_formatting.add(drng,FormulaRule(formula=[f'AND($B6<>"",{dc}6<>"",{dc}6<Dashboard!$C$3,{sc}6<>"Applied",{sc}6<>"N/A")'],font=Font(color=R,bold=True)))
k=LAST+2; tr.cell(row=k,column=3,value="Key:").font=Font(bold=True)
for j,(lab,c,fc) in enumerate([("Applied",G,"FFFFFF"),("In progress",A,"1F2A44"),("Overdue",R,"FFFFFF"),("Not started",GR,"5A6578"),("N/A",BL,"9AA3AF")]):
    x=tr.cell(row=k,column=5+j*2,value=lab); x.fill=PatternFill("solid",fgColor=c); x.font=Font(color=fc,bold=True); x.alignment=Alignment(horizontal="center")

# ---------------- Dashboard ----------------
db=wb.create_sheet("Dashboard")
db.sheet_view.showGridLines=False
db["B1"]="Control rollout dashboard"; db["B1"].font=Font(bold=True,size=16,color=NAVY)
db["B3"]="Status date"; db["B3"].font=Font(bold=True); db["C3"]="=TODAY()"; db["C3"].number_format="dd-mmm-yyyy"
db["D3"]="(set a fixed date here to report as at a past date)"; db["D3"].font=Font(italic=True,color="9AA3AF")
db.column_dimensions["A"].width=2; db.column_dimensions["B"].width=20
for c in "CDEFGH": db.column_dimensions[c].width=15
TR=lambda col: f"Tracker!${col}$6:${col}${LAST}"
B=TR("B")
def applied(r,t): return f'COUNTIFS({B},"{t}",{TR(L(5+r*2))},"Applied")'
def scope(r,t): return f'(COUNTIFS({B},"{t}")-COUNTIFS({B},"{t}",{TR(L(5+r*2))},"N/A"))'
def overdue(r,t):
    s,d=TR(L(5+r*2)),TR(L(4+r*2))
    return f'COUNTIFS({B},"{t}",{s},"<>Applied",{s},"<>N/A",{d},"<"&$C$3)'
def inprog(r,t): return f'COUNTIFS({B},"{t}",{TR(L(5+r*2))},"In progress")'
tiers=["Initial","Medium","Full"]
allA="+".join(applied(r,t) for r in range(5) for t in tiers)
allS="+".join(scope(r,t) for r in range(5) for t in tiers)
allO="+".join(overdue(r,t) for r in range(5) for t in tiers)
allP="+".join(inprog(r,t) for r in range(5) for t in tiers)
# KPI tiles
kp=[("Applied",f"={allA}","0"),("Total in scope",f"={allS}","0"),("% applied",f"=IF(C6=0,0,B6/C6)","0%"),("In progress",f"={allP}","0"),("Overdue",f"={allO}","0"),("Remaining",f"=C6-B6","0")]
for j,(lab,f,fmt) in enumerate(kp):
    a=db.cell(row=5,column=2+j,value=lab); a.font=Font(bold=True,color="5A6578"); a.alignment=Alignment(horizontal="center")
    b=db.cell(row=6,column=2+j,value=f); b.font=Font(bold=True,size=22,color=R if lab=="Overdue" else NAVY); b.number_format=fmt; b.alignment=Alignment(horizontal="center")
    for rr in (5,6): db.cell(row=rr,column=2+j).fill=PatternFill("solid",fgColor="EEF2F6")
db.row_dimensions[6].height=36
def matrix(top,title_,cellf,fmt,cf):
    db.cell(row=top,column=2,value=title_).font=Font(bold=True,size=12,color=NAVY)
    hdr=["","Initial (18)","Medium (10)","Full (6)","All (34)"]
    for j,h in enumerate(hdr):
        x=db.cell(row=top+1,column=2+j,value=h or None); x.font=HF; x.fill=HFILL; x.alignment=Alignment(horizontal="center")
    for r in range(5):
        rr=top+2+r; db.cell(row=rr,column=2,value=f"Ring {r+1}").font=Font(bold=True)
        for j,t in enumerate(tiers+["All"]):
            x=db.cell(row=rr,column=3+j,value=cellf([r],[t] if t!="All" else tiers)); x.number_format=fmt; x.alignment=Alignment(horizontal="center"); x.border=BOX
    rr=top+7; db.cell(row=rr,column=2,value="All rings").font=Font(bold=True)
    for j,t in enumerate(tiers+["All"]):
        x=db.cell(row=rr,column=3+j,value=cellf(range(5),[t] if t!="All" else tiers)); x.number_format=fmt; x.alignment=Alignment(horizontal="center"); x.border=BOX; x.font=Font(bold=True)
    cf(f"C{top+2}:F{top+7}")
    return top+9
pct=lambda rs,ts: "=IFERROR(("+"+".join(applied(r,t) for r in rs for t in ts)+")/("+"+".join(scope(r,t) for r in rs for t in ts)+"),0)"
cnt=lambda rs,ts: '=('+"+".join(applied(r,t) for r in rs for t in ts)+')&" / "&('+"+".join(scope(r,t) for r in rs for t in ts)+")"
od=lambda rs,ts: "="+"+".join(overdue(r,t) for r in rs for t in ts)
nx=matrix(8,"% of controls applied (heatmap)",pct,"0%",lambda rg: db.conditional_formatting.add(rg,ColorScaleRule(start_type="num",start_value=0,start_color="F8D7D7",mid_type="num",mid_value=0.5,mid_color="FCE7B5",end_type="num",end_value=1,end_color="63BE7B")))
nx=matrix(nx,"Controls applied / in scope",cnt,"@",lambda rg: None)
nx=matrix(nx,"Overdue: should be applied by now but are not",od,"0",lambda rg: (db.conditional_formatting.add(rg,FormulaRule(formula=[f"{rg.split(':')[0]}>0"],fill=fill(R),font=Font(color="FFFFFF",bold=True))),
          db.conditional_formatting.add(rg,FormulaRule(formula=[f"{rg.split(':')[0]}=0"],fill=fill("CDE8D4"),font=Font(color=G)))))
# target dates
db.cell(row=nx,column=2,value="Target dates per ring (default plan)").font=Font(bold=True,size=12,color=NAVY)
for j,h in enumerate(["","Initial","Medium","Full"]):
    x=db.cell(row=nx+1,column=2+j,value=h or None); x.font=HF; x.fill=HFILL; x.alignment=Alignment(horizontal="center")
for r in range(5):
    db.cell(row=nx+2+r,column=2,value=f"Ring {r+1}").font=Font(bold=True)
    for j,t in enumerate(tiers):
        x=db.cell(row=nx+2+r,column=3+j,value=TARGET[(r,t)]); x.number_format="dd-mmm-yy"; x.alignment=Alignment(horizontal="center"); x.border=BOX
db.cell(row=nx+8,column=2,value="Dates are placeholders. Change them per control on the Tracker tab.").font=Font(italic=True,color="9AA3AF")
wb.move_sheet("Dashboard",-1)
wb.active=0
wb.save(OUT); print("ok",LAST)
