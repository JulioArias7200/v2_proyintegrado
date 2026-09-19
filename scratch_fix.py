import re

with open("frontend/src/pages/MesaPartes.jsx", "r", encoding="utf-8") as f:
    content = f.read()

original_count = content.count("gridTemplateColumns: 'minmax(320px, 360px) 1fr'")
print(f"Found {original_count} grids to replace")

old_block = "        <div style={{\n          display: 'grid',\n          gridTemplateColumns: 'minmax(320px, 360px) 1fr',\n          gap: '24px',\n          alignItems: 'start'\n        }}>\n          <div style={{ position: 'sticky', top: '20px' }}>"

new_block = '        <div className="mesa-layout-grid">\n          <div className="mesa-banner-col" style={{ position: \'sticky\', top: \'20px\' }}>'

new_content = content.replace(old_block, new_block)
replaced = original_count - new_content.count("gridTemplateColumns: 'minmax(320px, 360px) 1fr'")
print(f"Replaced: {replaced}, Remaining: {new_content.count('minmax(320px')}")

with open("frontend/src/pages/MesaPartes.jsx", "w", encoding="utf-8") as f:
    f.write(new_content)
print("Done.")
