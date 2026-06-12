import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMTGGoldfishMovers } from "@/lib/mtggoldfish";

const row = (opts: {
  name: string;
  set: string;
  change: string;
  price: string;
  percent: string;
}) => {
  const dir = opts.change.startsWith("-") ? "decrease" : "increase";
  return `<tr>
<td class='text-end'><div class='common-price-change'><span class='${dir}'>${opts.change}</span></div></td>
<td class='text-center'><i class='set-symbol ss ss-fin'></i></td>
<td class='col-card'><span class='card_id card_name'><a data-card-id="${opts.name} [${opts.set}]" href="/price/some-set/184/x#paper">${opts.name}</a> <span class='card-num'>#184</span></span></td>
<td class='text-end'>$ ${opts.price}</td>
<td class='text-end'><span class='${dir}'>${opts.percent}</span></td>
</tr>`;
};

const page = `<html><body>
<h2>Daily Change</h2>
<table>
${row({ name: "The Earth Crystal", set: "FIN", change: "+0.59", price: "13.19", percent: "+5%" })}
${row({ name: "Phelia, Exuberant Shepherd", set: "MH3", change: "-1.20", price: "8.80", percent: "-12%" })}
</table>
<h2>Weekly Change</h2>
<table>
${row({ name: "Weekly Card", set: "ABC", change: "+9.99", price: "99.99", percent: "+99%" })}
</table>
</body></html>`;

describe("getMTGGoldfishMovers", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(page) })
    );
  });

  it("parses daily gainers and losers into the interests shape", async () => {
    const data = await getMTGGoldfishMovers();

    expect(data.average).toHaveLength(2);
    expect(data.average[0]).toMatchObject({
      name: "The Earth Crystal",
      percent: 5,
      new_price: 13.19,
      set_name: "FIN",
    });
    expect(data.average[0].old_price).toBeCloseTo(12.6, 2);
    expect(data.average[1]).toMatchObject({
      name: "Phelia, Exuberant Shepherd",
      percent: -12,
      new_price: 8.8,
    });
    expect(data.foil).toEqual([]);
  });

  it("strips escaped variant ids and decodes entities in card names", async () => {
    const variantPage = `<h2>Daily Change</h2><table>${row({
      name: "Ant-Man, Reformed Rogue &lt;019ea4cd-c571-72b4&gt;",
      set: "MSC",
      change: "+1.00",
      price: "10.00",
      percent: "+10%",
    })}${row({
      name: "Minsc &amp; Boo, Timeless Heroes",
      set: "CLB",
      change: "+1.00",
      price: "10.00",
      percent: "+10%",
    })}</table>`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(variantPage) })
    );

    const data = await getMTGGoldfishMovers();

    expect(data.average[0].name).toBe("Ant-Man, Reformed Rogue");
    expect(data.average[1].name).toBe("Minsc & Boo, Timeless Heroes");
  });

  it("excludes the weekly change section", async () => {
    const data = await getMTGGoldfishMovers();

    expect(data.average.map((m) => m.name)).not.toContain("Weekly Card");
  });

  it("returns empty arrays when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const data = await getMTGGoldfishMovers();

    expect(data).toEqual({ average: [], foil: [] });
  });
});
