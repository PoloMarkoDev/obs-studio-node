/******************************************************************************
    Copyright (C) 2016-2019 by Streamlabs (General Workings Inc)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

******************************************************************************/

#pragma once
#include <nan.h>
#include <node.h>
#include "input.hpp"
#include "isource.hpp"
#include "scene.hpp"
#include "utility-v8.hpp"

namespace osn
{
	class Transition : public osn::ISource, public utilv8::ManagedObject<osn::Transition>
	{
		friend class utilv8::ManagedObject<osn::Transition>;

		public:
		Transition(uint64_t id);

		// JavaScript
		public:
		static Nan::Persistent<v8::FunctionTemplate> prototype;

		static void Register(v8::Local<v8::Object> exports);

		static void Types(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void Create(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void CreatePrivate(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void FromName(const v8::FunctionCallbackInfo<v8::Value>& args);

		static void GetActiveSource(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void Clear(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void Set(const v8::FunctionCallbackInfo<v8::Value>& args);
		static void Start(const v8::FunctionCallbackInfo<v8::Value>& args);
	};
} // namespace osn
