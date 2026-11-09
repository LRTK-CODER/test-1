import { defineTheme } from '@lbs/theme-kit';
import { Layout } from './screens/layout';
import { Home } from './screens/list';
import { NotFound } from './screens/not-found';
import { Page } from './screens/page';
import { Post } from './screens/post';

/** 기본 테마. 카테고리 화면은 따로 두지 않아 Home이 그린다. */
export default defineTheme({ Layout, Home, Post, Page, NotFound });
