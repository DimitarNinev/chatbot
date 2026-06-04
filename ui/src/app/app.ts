import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from "@angular/router";
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ViewChild, ElementRef, HostListener } from '@angular/core';
import { SplitterModule } from 'primeng/splitter';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterOutlet,
    PickerComponent,
    SplitterModule,
    ButtonModule,
    TextareaModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  @ViewChild('messagesContainer')
  messagesContainer!: ElementRef;

  @ViewChild('emojiPicker')
  emojiPicker!: ElementRef;
  showEmojiPicker = false;

  inputMessage = '';

  messages: Message[] = [];

  loading = false;

  conversationId = crypto.randomUUID();

  chats: Chat[] = [];

  activeChatId = '';

  hasActiveChat = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadChats();
  }

  createNewChat() {
    const id = crypto.randomUUID();

    this.activeChatId = id;
    this.hasActiveChat = true;
    this.messages = [];

    this.chats = [
      { id, title: 'New Chat' },
      ...this.chats
    ];
  }

  loadChats() {
    this.http
      .get<any[]>('http://localhost:3000/api/chats')
      .subscribe(chats => {
        this.chats = chats.map(chat => ({
          id: chat.conversationId,
          title: chat.title || 'New Chat'
        }));

        this.cdr.detectChanges();
      });
  }

  selectChat(chatId: string) {
    this.activeChatId = chatId;
    this.hasActiveChat = true;
    this.loadChat(chatId);
  }

  deleteChat(chatId: string) {
    this.http.delete(
      `http://localhost:3000/api/chat/${chatId}`
    ).subscribe(() => {
      this.onChatDeleted(chatId);
    });
  }

  onChatDeleted(chatId: string) {
    this.chats = this.chats.filter(c => c.id !== chatId);

    if (!this.chats.length) {
      this.activeChatId = '';
      this.hasActiveChat = false;
      this.messages = [];
      this.cdr.detectChanges();
      return;
    }

    this.selectChat(this.chats[0].id);
    this.cdr.detectChanges();
  }

  scrollToBottom(): void {
    setTimeout(() => {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    }, 0);
  }

  loadChat(chatId: string) {
    setTimeout(() => {
      this.activeChatId = chatId;
    });

    this.http.get<any>(
      `http://localhost:3000/api/chat/${chatId}`
    ).subscribe(res => {
      this.messages = res.messages
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
          role: msg.role ?? 'assistant',
          content: msg.content ?? ''
        }));
      this.cdr.detectChanges();
      this.scrollToBottom();
    });

  }

  sendMessage() {
    if (this.showEmojiPicker) { this.showEmojiPicker = false };

    if (!this.inputMessage.trim()) return;

    const userMessage = this.inputMessage;
    this.messages = [
      ...this.messages,
      {
        role: 'user',
        content: userMessage
      }
    ];

    if (this.messages.length === 1) {
      this.chats = this.chats.map(chat =>
        chat.id === this.activeChatId
          ? {
            ...chat,
            title: userMessage.slice(0, 30)
          }
          : chat
      );
    }

    this.scrollToBottom();

    this.inputMessage = '';

    this.loading = true;

    this.http.post<any>(
      'http://localhost:3000/api/chat',
      {
        message: userMessage,
        conversationId: this.activeChatId
      }
    ).subscribe({
      next: (res) => {
        this.messages = [
          ...this.messages,
          {
            role: 'assistant',
            content: res.reply
          }
        ];

        this.loading = false;

        this.cdr.detectChanges();

        this.scrollToBottom();
      },

      error: (err) => {
        console.error(err);

        this.messages.push({
          role: 'assistant',
          content: 'Error communicating with AI.'
        });

        this.loading = false;
      }
    });
  }

  addEmoji(event: any) {
    this.inputMessage += event.emoji.native;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showEmojiPicker) {
      return;
    }

    const clickedInside =
      this.emojiPicker.nativeElement.contains(event.target);

    if (!clickedInside) {
      this.showEmojiPicker = false;
    }
  }

  toggleEmojiPicker(event: MouseEvent) {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
  }
}