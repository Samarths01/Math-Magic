css=open('style.css').read(); eng=open('engine.js').read(); arm=open('armory.js').read(); app=open('app.js').read()
html=f'''<title>Math Sprout</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{css}
</style>
<div class="layout">
  <main class="app" id="app" aria-live="polite"></main>
  <aside class="glass" id="glass" aria-label="Behind the glass: engine inspector"></aside>
</div>
<script>
{eng}
</script>
<script>
{arm}
</script>
<script>
{app}
</script>
'''
open('index.html','w').write(html); print(len(html))
