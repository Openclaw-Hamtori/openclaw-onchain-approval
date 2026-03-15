# PRD — OpenClaw Onchain Approval

## Working concept
OpenClaw가 블록체인 결제/자산 이동 관련 액션을 실행하기 전에 approval gate를 거치게 하는 local-first SDK / reference implementation.

## First attachment point
- OpenClaw

## Domain focus
- blockchain payments
- agent approvals
- signed approval receipt
- optional attestation later

## MVP thesis
첫 MVP는 거창한 온체인 attestation 전체가 아니라, 아래를 먼저 증명한다.
1. 어떤 액션이 approval-required인지 정책으로 판정 가능하다.
2. OpenClaw 액션 요청을 receipt payload로 정규화할 수 있다.
3. 사용자가 서명/승인하면 검증 가능한 approval receipt가 생성된다.
4. receipt verification 통과 시에만 후속 액션이 실행된다.

## MVP product shape
- local package / SDK
- OpenClaw integration example
- signed approval receipt format
- policy rules for high-risk onchain actions
- verification utility

## Examples of gated actions
- transfer
- swap
- bridge
- token approval / allowance expansion
- contract interaction
- unknown/new address interaction

## Non-goals for first MVP
- full wallet product
- exchange integration sprawl
- hosted SaaS dashboard
- fiat payment rails
- multi-chain production support from day one
