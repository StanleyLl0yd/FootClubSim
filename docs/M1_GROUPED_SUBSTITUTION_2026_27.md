# M1-P3: IFAB 2026/27 multiple substitutions at one stoppage

**19 October 2026. Isolated observational rule subset, not completed
substitutions, official referee authority or match engine v9.**

The [IFAB time-limited substitution protocol](https://theifab.com/laws/latest/time-limited-substitution-protocol/)
and [Law 3](https://theifab.com/laws/latest/the-players/) provide:

- For two or more departures in a single stoppage, **each** departing
  player must be off by ten seconds after the **last board/signal**.
  The signals must not be artificially delayed between substitutions.
- If the deadline is exceeded, a substitute ordinarily must wait for the
  first stoppage after 60 seconds of **running** play following restart,
  with independent referee permission. Neither an automatic yellow card nor
  dismissal may be fabricated. Injury, safety and proximity exceptions
  require a trusted individual referee determination.
- Several substitutions by one team during the same stoppage use **one**
  in-play opportunity, not an opportunity per player; the two teams'
  opportunities are accounted for separately.

`src/core/m1-grouped-substitution-clock.ts` provides isolated **schema 2**
closed-shape, plain-JSON inspection of one team with 2..5 proposed
substitutions. It compares each named source exit against the **final signal
time** in wall-clock seconds. Identifiers, order, eligible initial named
participants, distinct incoming/outgoing players, individual signal
chronology and running-clock restart time are all checked and bounded.
Its output separates timely and late departures with a conditional return
threshold, but **never authorizes an incoming player**.

The earlier standalone **schema-1 single substitution** remains exactly
unchanged and still rejects grouped input. Source hashes, M0 and v3-v8
save and event schemas also remain unchanged. No in-match active XI
changes or additional official league points are performed.

### Why this does not close P3

An external referee controller must verify that the players were actually
on the field and substitutes on the unused bench at the precise stoppage;
that board signals were given promptly, there was a legal restart, that any
injury/proximity/safety exception was authorized, and that the incoming
player entered from the correct halfway-line boundary with referee permission.
The 300-second M1 phase clock **cannot** prove these facts. Independently
verified time-limited substitutions also must not force an automatic defeat
when temporarily fewer than seven players are physically present.

A fake `stoppageId` or `refereeSignalId` is not authentication. The
separate Ed25519 research verifier proves **only** possession of a pinned
key, not appointment as official match authority. Both modules remain
nonproduction prototypes. P3 [#29](https://github.com/StanleyLl0yd/FootClubSim/issues/29),
P4 [#30](https://github.com/StanleyLl0yd/FootClubSim/issues/30)
and M1 exit [#3](https://github.com/StanleyLl0yd/FootClubSim/issues/3)
stay OPEN. M2 prohibited.
