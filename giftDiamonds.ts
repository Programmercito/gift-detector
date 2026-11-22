type GiftEvent = {
    diamondCount?: number;
    giftDetails?: { diamondCount?: number; giftType?: number };
    gift?: { diamondCount?: number; type?: number; gift_type?: number };
    giftType?: number;
    repeatCount?: number;
    repeatEnd?: boolean | number;
};

export function getReceivedDiamonds(event: GiftEvent): number {
    const diamondCount = Number(event.giftDetails?.diamondCount ?? event.gift?.diamondCount ?? event.diamondCount ?? 0);
    const repeatCount = Number(event.repeatCount ?? 1);
    const giftType = Number(
        event.gift?.type ?? event.gift?.gift_type ?? event.giftDetails?.giftType ?? event.giftType ?? 0,
    );
    const repeatEnded = event.repeatEnd === true || event.repeatEnd === 1;

    // Streak updates are cumulative, so intermediate updates must not be added.
    if (giftType === 1 && !repeatEnded) return 0;
    if (!Number.isFinite(diamondCount) || !Number.isFinite(repeatCount) || diamondCount <= 0 || repeatCount <= 0) {
        return 0;
    }

    return diamondCount * repeatCount;
}
