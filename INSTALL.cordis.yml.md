# How to mount @lcthe/dsh-timeline-rail into a DeepSeek Harness web deployment.
#
# 1) Make the package resolvable by the web profile. Add it as a dependency of
#    your web app / bundle package.json, for example:
#
#      pnpm add @lcthe/dsh-timeline-rail
#
#    (or add "@lcthe/dsh-timeline-rail": "^0.1.0" to the package.json of the
#    deployment owning the web bundle).
#
# 2) Add the plugin row to your `cordis.yml` (same include level as the other
#    bundle rows). It reaches the conversation dock through the web bundle,
#    so no further wiring is needed:
#
# - insert:
#     - id: dsh-timeline-rail
#       name: '@lcthe/dsh-timeline-rail'
#
# Because DSH treats dynamic plugins as first-class too, you can alternatively
# load this same package in-session with the dynamic-cordis tool — see README.
