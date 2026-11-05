import json, os, datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule, CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.utils import get_column_letter as L

S = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"data.json")))
OUT = "/home/user/Network-Intelligence-/docs/control-rollout/Ring_Control_Rollout_Tracker.xlsx"
NAVY="1F2A44"; ACC="2F6F8F"; LIGHT="EEF2F6"
HF = Font(bold=True, color="FFFFFF", name="Calibri"); HFILL = PatternFill("solid", fgColor=NAVY)
TITLE = Font(bold=True, size=16, color=NAVY); SUB = Font(italic=True, color="5A6578")
thin = Side(style="thin", color="D5DBE3"); BOX = Border(left=thin,right=thin,top=thin,bottom=thin)
D = dt.date.fromisoformat
HEAT = {  # state: (fill, font)
 "Implemented":("1B7F3B","FFFFFF"), "Pending evidence":("9BD3A5","1F2A44"), "In progress":("F2B53A","1F2A44"),
 "Due soon":("FFE08A","1F2A44"), "Overdue":("D64545","FFFFFF"), "Blocked":("8E1B1B","FFFFFF"),
 "Planned":("8DB7E0","1F2A44"), "Not started":("E3E7EC","5A6578"), "Exception":("7B5EA7","FFFFFF"), "N/A":("F5F6F8","9AA3AF"),
 "On plan":("1B7F3B","FFFFFF"), "GAP":("D64545","FFFFFF"), "Evidence due":("9BD3A5","1F2A44"), "Early":("2F6F8F","FFFFFF"),
 "Not yet due":("E3E7EC","5A6578"),
 "Green":("1B7F3B","FFFFFF"), "Amber":("F2B53A","1F2A44"), "Red":("D64545","FFFFFF"),
}
STATUSES = ["Not started","Planned","In progress","Pending evidence","Implemented","Exception","Blocked","N/A"]

def header(ws, row, cols, widths=None):
    for i,c in enumerate(cols,1):
        x=ws.cell(row=row,column=i,value=c); x.font=HF; x.fill=HFILL; x.alignment=Alignment(wrap_text=True,vertical="center")
    if widths:
        for i,w in enumerate(widths,1): ws.column_dimensions[L(i)].width=w
def title(ws, t, s):
    ws["A1"]=t; ws["A1"].font=TITLE; ws["A2"]=s; ws["A2"].font=SUB
def heat_cf(ws, rng, states):
    first = rng.split(":")[0].replace("$","")
    for st in states:
        f,fc = HEAT[st]
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{first}="{st}"'], fill=PatternFill("solid",fgColor=f,bgColor=f), font=Font(color=fc, bold=st in("Overdue","Blocked","GAP","Red"))))
def table(ws, ref, name):
    t=Table(displayName=name, ref=ref); t.tableStyleInfo=TableStyleInfo(name="TableStyleLight1", showRowStripes=True); ws.add_table(t)

wb=Workbook()
# ---------- README ----------
ws=wb.active; ws.title="README"
title(ws,"Technical Control Rollout: Ring Tracker","Single source of truth for phased deployment of 34 technical controls across 5 rings (170 deployments).")
lines=[
("Purpose","Track what is applied in each ring, what is left, and where controls should already be in place but are not."),
("Status date","Set on the Lookups sheet (cell B3). All due / overdue / RAG logic is measured against it. Use =TODAY() for live tracking."),
("Weekly update","Update ONLY the 'Deployment Matrix' sheet: Status, Actual date, % deployed, Exception ref, Comment, Last updated, Updated by. Every other sheet is formula-driven."),
("Control tiers","Initial Controls (18, IC-01..IC-18) -> Medium Coverage (10, MC-01..MC-10) -> Full Coverage (6, FC-01..FC-06)."),
("Rings","Ring 1 (pilot) through Ring 5 (full estate). Scope, population and tier target dates are on 'Ring Plan'."),
("Status values","Not started | Planned | In progress | Pending evidence (deployed, awaiting verification) | Implemented (verified) | Exception (risk accepted) | Blocked | N/A"),
("Heat state","Derived: Overdue = planned date passed and not implemented/excepted; Due soon = planned within the amber window (Lookups B4, default 14 days)."),
("RAG (per deployment)","Red = Overdue or Blocked. Amber = Due soon, Exception, or Pending evidence for more than 10 days. Green = everything else. N/A excluded."),
("RAG (roll-up)","A ring/tier is Red if 10% or more of its due deployments are Red, Amber if any are Red/Amber, otherwise Green."),
("Completion","% complete = Implemented / in-scope deployments (N/A excluded). Schedule adherence = Implemented / deployments due by the status date."),
("Sample data","Control names marked PLACEHOLDER and all statuses/dates are SAMPLE data so every state can be seen. Replace with real data."),
("Dashboard","An interactive dashboard reads the same data (deployments.csv exported from 'Deployment Matrix')."),
]
for i,(a,b) in enumerate(lines,4):
    ws.cell(row=i,column=1,value=a).font=Font(bold=True,color=NAVY); c=ws.cell(row=i,column=2,value=b); c.alignment=Alignment(wrap_text=True,vertical="top")
ws.column_dimensions["A"].width=22; ws.column_dimensions["B"].width=110
r=len(lines)+6; ws.cell(row=r,column=1,value="Colour key").font=Font(bold=True,color=NAVY)
for j,st in enumerate(["Implemented","Pending evidence","In progress","Due soon","Overdue","Blocked","Planned","Not started","Exception","N/A"]):
    c=ws.cell(row=r+1+j,column=1,value=st); f,fc=HEAT[st]; c.fill=PatternFill("solid",fgColor=f); c.font=Font(color=fc,bold=True)

# ---------- Lookups ----------
lk=wb.create_sheet("Lookups"); title(lk,"Lookups","Parameters and lists used by formulas.")
lk["A3"]="Status date"; lk["B3"]=D(S["as_of"]); lk["B3"].number_format="dd-mmm-yyyy"; lk["C3"]="Replace with =TODAY() for live tracking"
lk["A4"]="Amber window (days)"; lk["B4"]=14
lk["A5"]="Evidence overdue after (days)"; lk["B5"]=10
lk["A6"]="Roll-up red threshold"; lk["B6"]=0.10; lk["B6"].number_format="0%"
for c in ("A3","A4","A5","A6"): lk[c].font=Font(bold=True)
lk["B3"].fill=lk["B4"].fill=lk["B5"].fill=lk["B6"].fill=PatternFill("solid",fgColor="FFF4CC")
lk["A8"]="Status list"; lk["A8"].font=Font(bold=True)
for i,s in enumerate(STATUSES,9): lk.cell(row=i,column=1,value=s)
lk["C8"]="Tiers"; lk["C8"].font=Font(bold=True)
for i,(t,n) in enumerate([("Initial",18),("Medium",10),("Full",6)],9): lk.cell(row=i,column=3,value=t); lk.cell(row=i,column=4,value=n)
lk["F8"]="Rings"; lk["F8"].font=Font(bold=True)
for i in range(5): lk.cell(row=9+i,column=6,value=f"Ring {i+1}")
lk.column_dimensions["A"].width=30; lk.column_dimensions["B"].width=14; lk.column_dimensions["C"].width=12
for n,ref in [("StatusDate","Lookups!$B$3"),("AmberDays","Lookups!$B$4"),("EvidenceDays","Lookups!$B$5"),("RedThreshold","Lookups!$B$6"),("StatusList","Lookups!$A$9:$A$16")]:
    wb.defined_names[n]=DefinedName(n, attr_text=ref)

# ---------- Control Register ----------
cr=wb.create_sheet("Control Register",1); title(cr,"Control Register","34 controls in three coverage tiers. Names are PLACEHOLDERS - replace with your control set.")
cols=["Control ID","Tier","Control name","Domain","Framework mapping","Risk if absent","Control owner","Depends on","Evidence required","Placeholder?"]
header(cr,4,cols,[11,10,42,13,28,13,16,14,40,12])
for i,c in enumerate(S["controls"],5):
    vals=[c[0],c[1],c[2],c[3],S["fw"][c[3]],c[4],c[5],c[6].replace(";",", "),"Compliance report export from management console","PLACEHOLDER"]
    for j,v in enumerate(vals,1): cr.cell(row=i,column=j,value=v)
table(cr,f"A4:J{4+len(S['controls'])}","tblControls"); cr.freeze_panes="D5"

# ---------- Ring Plan ----------
rp=wb.create_sheet("Ring Plan",2); title(rp,"Ring Plan","Scope and target dates per ring and tier. Planned dates per control default from these.")
cols=["Ring","Scope","Population (devices)","Business owner","Initial target","Medium target","Full target","Go / no-go criteria","Exit criteria"]
header(rp,4,cols,[9,40,14,22,14,14,14,46,40])
for i,r in enumerate(S["rings"],5):
    vals=[r[0],r[1],r[2],r[6],D(r[3]),D(r[4]),D(r[5]),"Previous ring >=95% Initial controls verified; no open P1/P2 incidents","All in-scope controls Implemented or risk accepted"]
    for j,v in enumerate(vals,1):
        c=rp.cell(row=i,column=j,value=v)
        if j in (5,6,7): c.number_format="dd-mmm-yy"
        if j==3: c.number_format="#,##0"
table(rp,"A4:I9","tblRings")

# ---------- Deployment Matrix ----------
dm=wb.create_sheet("Deployment Matrix",3)
title(dm,"Deployment Matrix","One row per control per ring (170). Update the yellow columns weekly; grey columns are formulas.")
cols=["Key","Control ID","Tier","Control name","Owner","Risk if absent","Ring","Population","Planned date","Actual date","Status","% deployed","Exception ref","Comment","Last updated","Updated by",
      "Due by status date","Days variance","Heat state","RAG","Schedule check","Expected (1/0)","Implemented (1/0)"]
header(dm,4,cols,[16,10,9,38,15,11,8,11,12,12,17,11,13,46,13,12,13,11,16,8,14,10,10])
rows=S["rows"]; n=len(rows); last=4+n
for i,r in enumerate(rows,5):
    v=[r["key"],r["control_id"],r["tier"],r["control_name"],r["owner"],r["risk_if_absent"],r["ring"],r["population"],D(r["planned_date"]),
       D(r["actual_date"]) if r["actual_date"] else None, r["status"], r["pct_deployed"]/100, r["exception_ref"] or None, r["comment"] or None, D(S["as_of"]), "PMO"]
    for j,x in enumerate(v,1): dm.cell(row=i,column=j,value=x)
    for col in "IJO": dm[f"{col}{i}"].number_format="dd-mmm-yy"
    dm[f"L{i}"].number_format="0%"
    dm[f"Q{i}"]=f'=IF(I{i}<=StatusDate,"Due","Not yet due")'
    dm[f"R{i}"]=f'=IF(K{i}="N/A","",IF(J{i}<>"",J{i}-I{i},IF(I{i}<StatusDate,StatusDate-I{i},"")))'
    dm[f"S{i}"]=(f'=IF(K{i}="Implemented","Implemented",IF(K{i}="Pending evidence","Pending evidence",IF(K{i}="Exception","Exception",'
                 f'IF(K{i}="N/A","N/A",IF(K{i}="Blocked","Blocked",IF(I{i}<StatusDate,"Overdue",IF(K{i}="In progress","In progress",'
                 f'IF(I{i}-StatusDate<=AmberDays,"Due soon",IF(K{i}="Planned","Planned","Not started")))))))))')
    dm[f"T{i}"]=(f'=IF(S{i}="N/A","N/A",IF(OR(S{i}="Overdue",S{i}="Blocked"),"Red",IF(OR(S{i}="Due soon",S{i}="Exception",'
                 f'AND(S{i}="Pending evidence",J{i}<>"",StatusDate-J{i}>EvidenceDays)),"Amber","Green")))')
    dm[f"U{i}"]=(f'=IF(K{i}="N/A","N/A",IF(I{i}<=StatusDate,IF(K{i}="Implemented","On plan",IF(K{i}="Pending evidence","Evidence due",'
                 f'IF(K{i}="Exception","Exception","GAP"))),IF(K{i}="Implemented","Early","Not yet due")))')
    dm[f"V{i}"]=f'=IF(AND(K{i}<>"N/A",I{i}<=StatusDate),1,0)'
    dm[f"W{i}"]=f'=IF(K{i}="Implemented",1,0)'
    for col in "QRSTUVW": dm[f"{col}{i}"].fill=PatternFill("solid",fgColor="F2F4F7")
    for col in "JKLMNOP": dm[f"{col}{i}"].fill=PatternFill("solid",fgColor="FFF9E0")
table(dm,f"A4:W{last}","tblDeploy"); dm.freeze_panes="E5"
dv=DataValidation(type="list", formula1="=StatusList", allow_blank=False); dm.add_data_validation(dv); dv.add(f"K5:K{last}")
heat_cf(dm,f"S5:S{last}",["Implemented","Pending evidence","In progress","Due soon","Overdue","Blocked","Planned","Exception"])
heat_cf(dm,f"T5:T{last}",["Green","Amber","Red"])
heat_cf(dm,f"U5:U{last}",["On plan","GAP","Evidence due","Early","Exception"])
DMR=lambda col: f"'Deployment Matrix'!${col}$5:${col}${last}"

# ---------- Heatmaps ----------
def heatmap(name, src_col, states, subtitle, pos):
    hm=wb.create_sheet(name,pos); title(hm,name,subtitle)
    hm["A3"]="Status date:"; hm["B3"]="=StatusDate"; hm["B3"].number_format="dd-mmm-yyyy"; hm["A3"].font=Font(bold=True)
    header(hm,5,["Control ID","Control name","Ring 1","Ring 2","Ring 3","Ring 4","Ring 5"],[11,40,17,17,17,17,17])
    r=6
    for tier,cnt in [("Initial",18),("Medium",10),("Full",6)]:
        c=hm.cell(row=r,column=1,value=f"{tier} {'Controls' if tier=='Initial' else 'Coverage'} ({cnt})"); c.font=Font(bold=True,color="FFFFFF")
        for j in range(1,8): hm.cell(row=r,column=j).fill=PatternFill("solid",fgColor=ACC)
        for j in range(5):
            ring=f"Ring {j+1}"
            x=hm.cell(row=r,column=3+j,value=f'=COUNTIFS({DMR("C")},"{tier}",{DMR("G")},"{ring}",{DMR("K")},"Implemented")&" / "&COUNTIFS({DMR("C")},"{tier}",{DMR("G")},"{ring}",{DMR("K")},"<>N/A")&" done"')
            x.font=Font(bold=True,color="FFFFFF"); x.alignment=Alignment(horizontal="center")
        r+=1; start=r
        for c in [c for c in S["controls"] if c[1]==tier]:
            hm.cell(row=r,column=1,value=c[0]); hm.cell(row=r,column=2,value=c[2])
            for j in range(5):
                x=hm.cell(row=r,column=3+j,value=f'=INDEX({DMR(src_col)},MATCH($A{r}&" · "&{L(3+j)}$5,{DMR("A")},0))')
                x.alignment=Alignment(horizontal="center"); x.border=BOX
            r+=1
        heat_cf(hm,f"C{start}:G{r-1}",states)
    hm.freeze_panes="C6"
    r+=1; hm.cell(row=r,column=1,value="Key").font=Font(bold=True)
    for k,st in enumerate(states):
        c=hm.cell(row=r+1+k//5,column=3+k%5,value=st); f,fc=HEAT[st]; c.fill=PatternFill("solid",fgColor=f); c.font=Font(color=fc); c.alignment=Alignment(horizontal="center")
heatmap("Heatmap","S",["Implemented","Pending evidence","In progress","Due soon","Overdue","Blocked","Planned","Not started","Exception","N/A"],
        "Current state of every control in every ring. Red = should already be in place but is not.",4)
heatmap("Expected vs Actual","U",["On plan","Evidence due","GAP","Early","Not yet due","Exception","N/A"],
        "Where controls were due by the status date versus what is actually implemented. GAP = due but not implemented.",5)

# ---------- Ring x Tier Summary ----------
sm=wb.create_sheet("Ring x Tier Summary",6); title(sm,"Ring x Tier Summary","What is applied per ring and tier, what is expected by today, and what is left.")
cols=["Ring","Tier","In scope","Implemented","Pending evidence","Expected by today","Schedule gap","Remaining","Overdue","Blocked","Exceptions","% complete","Schedule adherence","RAG"]
header(sm,4,cols,[9,10,10,12,12,13,12,11,10,10,11,11,13,9])
r=5
def cif(ring_cond, tier_cond, extra):
    return f'COUNTIFS({DMR("G")},{ring_cond},{DMR("C")},{tier_cond}{extra})'
for ring in [x[0] for x in S["rings"]]+["All rings"]:
    for tier in ["Initial","Medium","Full","All tiers"]:
        rc = f'"{ring}"' if ring!="All rings" else '"*"'; tc = f'"{tier}"' if tier!="All tiers" else '"*"'
        sm.cell(row=r,column=1,value=ring); sm.cell(row=r,column=2,value=tier)
        sm.cell(row=r,column=3,value="="+cif(rc,tc,f',{DMR("K")},"<>N/A"'))
        sm.cell(row=r,column=4,value="="+cif(rc,tc,f',{DMR("K")},"Implemented"'))
        sm.cell(row=r,column=5,value="="+cif(rc,tc,f',{DMR("K")},"Pending evidence"'))
        sm.cell(row=r,column=6,value="="+cif(rc,tc,f',{DMR("V")},1'))
        sm.cell(row=r,column=7,value="="+cif(rc,tc,f',{DMR("U")},"GAP"')+"+"+cif(rc,tc,f',{DMR("U")},"Evidence due"'))
        sm.cell(row=r,column=8,value=f"=C{r}-D{r}")
        sm.cell(row=r,column=9,value="="+cif(rc,tc,f',{DMR("S")},"Overdue"'))
        sm.cell(row=r,column=10,value="="+cif(rc,tc,f',{DMR("S")},"Blocked"'))
        sm.cell(row=r,column=11,value="="+cif(rc,tc,f',{DMR("S")},"Exception"'))
        sm.cell(row=r,column=12,value=f"=IF(C{r}=0,0,D{r}/C{r})").number_format="0%"
        sm.cell(row=r,column=13,value=f'=IF(F{r}=0,"n/a",'+cif(rc,tc,f',{DMR("V")},1,{DMR("K")},"Implemented"')+f'/F{r})').number_format="0%"
        sm.cell(row=r,column=14,value=f'=IF(F{r}=0,"Not due",IF((I{r}+J{r})/F{r}>=RedThreshold,"Red",IF('+cif(rc,tc,f',{DMR("T")},"Red"')+"+"+cif(rc,tc,f',{DMR("T")},"Amber"')+'>0,"Amber","Green")))')
        if tier=="All tiers" or ring=="All rings":
            for j in range(1,15): sm.cell(row=r,column=j).font=Font(bold=True); sm.cell(row=r,column=j).fill=PatternFill("solid",fgColor=LIGHT)
        r+=1
heat_cf(sm,f"N5:N{r-1}",["Green","Amber","Red"]); sm.freeze_panes="C5"
# compact matrix
r+=2; sm.cell(row=r,column=1,value="Compact view: implemented / in scope (% complete)").font=Font(bold=True,size=12,color=NAVY); r+=1
header_row=r
for j,h in enumerate(["Ring","Initial (18)","Medium (10)","Full (6)","All (34)"],1):
    c=sm.cell(row=r,column=j,value=h); c.font=HF; c.fill=HFILL
for k,ring in enumerate([x[0] for x in S["rings"]]+["All rings"]):
    rr=r+1+k; sm.cell(row=rr,column=1,value=ring).font=Font(bold=True)
    for j,tier in enumerate(["Initial","Medium","Full","All tiers"]):
        src=5+k*4+j
        sm.cell(row=rr,column=2+j,value=f'=D{src}&" / "&C{src}&"  ("&TEXT(L{src},"0%")&")"').alignment=Alignment(horizontal="center")
        sm.conditional_formatting.add(f"{L(2+j)}{rr}", FormulaRule(formula=[f'$N${src}="Red"'], fill=PatternFill("solid",fgColor="F6CACA",bgColor="F6CACA")))
        sm.conditional_formatting.add(f"{L(2+j)}{rr}", FormulaRule(formula=[f'$N${src}="Amber"'], fill=PatternFill("solid",fgColor="FCE7B5",bgColor="FCE7B5")))
        sm.conditional_formatting.add(f"{L(2+j)}{rr}", FormulaRule(formula=[f'$N${src}="Green"'], fill=PatternFill("solid",fgColor="CDE8D4",bgColor="CDE8D4")))
for col in "BCDE": sm.column_dimensions[col].width=max(sm.column_dimensions[col].width or 0,18)
ALLROW = 5+5*4+3  # All rings / All tiers

# ---------- Dashboard sheet ----------
db=wb.create_sheet("Dashboard",0)
title(db,"Technical Control Rollout: Programme Dashboard","Executive view. All figures are formulas over the Deployment Matrix.")
db["A3"]="Status date"; db["B3"]="=StatusDate"; db["B3"].number_format="dd mmm yyyy"; db["A3"].font=Font(bold=True)
S_="'Ring x Tier Summary'!"
kpis=[("Overall completion",f"={S_}L{ALLROW}","0%"),("Implemented",f"={S_}D{ALLROW}&\" of \"&{S_}C{ALLROW}",None),
      ("Schedule adherence",f"={S_}M{ALLROW}","0%"),("Overdue",f"={S_}I{ALLROW}","0"),("Blocked",f"={S_}J{ALLROW}","0"),("Exceptions",f"={S_}K{ALLROW}","0")]
for j,(lab,f,fmt) in enumerate(kpis):
    col=1+j*2
    db.merge_cells(start_row=5,start_column=col,end_row=5,end_column=col+1); db.merge_cells(start_row=6,start_column=col,end_row=6,end_column=col+1)
    a=db.cell(row=5,column=col,value=lab); a.font=Font(color="5A6578",bold=True); a.alignment=Alignment(horizontal="center")
    b=db.cell(row=6,column=col,value=f); b.font=Font(size=24,bold=True,color=NAVY); b.alignment=Alignment(horizontal="center")
    if fmt: b.number_format=fmt
    for rr in (5,6):
        for cc in (col,col+1): db.cell(row=rr,column=cc).fill=PatternFill("solid",fgColor=LIGHT)
for c in range(1,13): db.column_dimensions[L(c)].width=13
db.row_dimensions[6].height=38
db["A8"]=(f'=TEXT({S_}D{ALLROW},"0")&" of "&{S_}C{ALLROW}&" deployments implemented ("&TEXT({S_}L{ALLROW},"0%")&"); "&{S_}I{ALLROW}+{S_}J{ALLROW}&" overdue or blocked; schedule adherence "&TEXT({S_}M{ALLROW},"0%")&"."')
db["A8"].font=Font(italic=True,size=12,color=NAVY)
db["A10"]="Ring x tier: % complete and RAG"; db["A10"].font=Font(bold=True,size=12,color=NAVY)
for j,h in enumerate(["Ring","Initial","RAG","Medium","RAG","Full","RAG","All","RAG"],1):
    c=db.cell(row=11,column=j,value=h); c.font=HF; c.fill=HFILL; c.alignment=Alignment(horizontal="center")
for k in range(5):
    rr=12+k; db.cell(row=rr,column=1,value=f"Ring {k+1}").font=Font(bold=True)
    for j in range(4):
        src=5+k*4+j
        x=db.cell(row=rr,column=2+j*2,value=f"={S_}L{src}"); x.number_format="0%"; x.alignment=Alignment(horizontal="center")
        y=db.cell(row=rr,column=3+j*2,value=f"={S_}N{src}"); y.alignment=Alignment(horizontal="center")
heat_cf(db,"C12:I16",["Green","Amber","Red"])
db.conditional_formatting.add("B12:B16", CellIsRule(operator="between", formula=["0","1"], fill=None))
from openpyxl.formatting.rule import ColorScaleRule
for col in "BDFH": db.conditional_formatting.add(f"{col}12:{col}16", ColorScaleRule(start_type="num",start_value=0,start_color="F3F5F8",end_type="num",end_value=1,end_color="2F6F8F"))
db["A18"]="Deployments by heat state"; db["A18"].font=Font(bold=True,size=12,color=NAVY)
for j,h in enumerate(["State","Ring 1","Ring 2","Ring 3","Ring 4","Ring 5","Total"],1):
    c=db.cell(row=19,column=j,value=h); c.font=HF; c.fill=HFILL
for k,st in enumerate(["Implemented","Pending evidence","In progress","Due soon","Overdue","Blocked","Planned","Not started","Exception","N/A"]):
    rr=20+k; c=db.cell(row=rr,column=1,value=st); f,fc=HEAT[st]; c.fill=PatternFill("solid",fgColor=f); c.font=Font(color=fc,bold=True)
    for j in range(5): db.cell(row=rr,column=2+j,value=f'=COUNTIFS({DMR("S")},$A{rr},{DMR("G")},"Ring {j+1}")')
    db.cell(row=rr,column=7,value=f"=SUM(B{rr}:F{rr})").font=Font(bold=True)
rr=30; db.cell(row=rr,column=1,value="Total").font=Font(bold=True)
for j in range(6): db.cell(row=rr,column=2+j,value=f"=SUM({L(2+j)}20:{L(2+j)}29)").font=Font(bold=True)
db.sheet_view.showGridLines=False
for w in wb.worksheets:
    if w.title!="Dashboard": w.sheet_view.zoomScale=100
wb.save(OUT); print("saved", OUT)
