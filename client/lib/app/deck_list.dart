/// Deck list (home): the decks available from the current [DeckSource]. Responsive
/// — a grid on wide screens, a list on narrow ones.
library;

import 'package:flutter/material.dart';

import '../data/deck_source.dart';

class DeckListScreen extends StatelessWidget {
  const DeckListScreen({
    super.key,
    required this.source,
    required this.onOpen,
    this.onBack,
  });

  final DeckSource source;
  final void Function(String deckId) onOpen;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final decks = source.decks();
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      appBar: AppBar(
        leading: onBack != null
            ? IconButton(
                key: const Key('decklist-back'),
                icon: const Icon(Icons.arrow_back),
                onPressed: onBack)
            : null,
        title: const Text('CyberDeck'),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Chip(
                label: Text(source.label),
                visualDensity: VisualDensity.compact,
                backgroundColor: const Color(0xFF12202B),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: decks.isEmpty
            ? const Center(child: Text('No decks available'))
            : LayoutBuilder(
                builder: (context, c) {
                  final cols = (c.maxWidth ~/ 320).clamp(1, 4);
                  return GridView.count(
                    crossAxisCount: cols,
                    padding: const EdgeInsets.all(16),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 2.6,
                    children: [
                      for (final d in decks)
                        _DeckCard(deck: d, onTap: () => onOpen(d.id)),
                    ],
                  );
                },
              ),
      ),
    );
  }
}

class _DeckCard extends StatelessWidget {
  const _DeckCard({required this.deck, required this.onTap});
  final DeckSummary deck;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF12202B),
      child: InkWell(
        key: Key('deck-card-${deck.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.grid_view, color: Color(0xFF00E5FF)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(deck.title,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(deck.subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white54, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white38),
            ],
          ),
        ),
      ),
    );
  }
}
